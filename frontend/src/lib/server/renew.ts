import { prisma } from "@/lib/server/prisma";
import { chargeRecurring } from "@/lib/server/yookassa";

const DAY = 86_400_000;

// Автопродление: находит подписки с истёкшим периодом и сохранённым способом
// оплаты, списывает по нему. Ручные компы из админки (grantedBy) не трогаем.
// Idempotence-Key детерминированный, поэтому повторный тик до прихода вебхука
// не создаёт второй платёж. Финализирует и вебхук, и этот код — идемпотентно
// по yookassaPaymentId, кто первый.
export async function renewDueSubscriptions(now = new Date()): Promise<{ charged: number; failed: number }> {
  const priceRub = Number(process.env.SUBSCRIPTION_PRICE_RUB ?? 990);
  const due = await prisma.subscription.findMany({
    where: {
      status: "active",
      plan: "pro",
      grantedBy: null,
      paymentMethodId: { not: null },
      currentPeriodEnd: { lte: now },
    },
  });

  let charged = 0;
  let failed = 0;
  for (const sub of due) {
    const periodKey = (sub.currentPeriodEnd ?? now).toISOString().slice(0, 10);
    try {
      const payment = await chargeRecurring({
        paymentMethodId: sub.paymentMethodId!,
        amountRub: priceRub,
        description: `Продление Pro — психолог #${sub.psychologistId}`,
        metadata: { psychologistId: String(sub.psychologistId), kind: "renewal" },
        idempotenceKey: `renew-${sub.psychologistId}-${periodKey}`,
      });

      if (payment.status === "succeeded") {
        const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
        const end = new Date(base.getTime() + 30 * DAY);
        // Не перетираем, если вебхук уже провёл именно этот платёж.
        await prisma.subscription.updateMany({
          where: { psychologistId: sub.psychologistId, NOT: { yookassaPaymentId: payment.id } },
          data: { status: "active", yookassaPaymentId: payment.id, currentPeriodEnd: end },
        });
        charged++;
      }
      // pending / waiting_for_capture — довершит вебхук.
    } catch (e) {
      // Списание не прошло — снимаем PRO до ручной оплаты (падаем на бесплатный).
      await prisma.subscription.update({
        where: { psychologistId: sub.psychologistId },
        data: { status: "inactive" },
      });
      failed++;
      console.error(`Продление подписки #${sub.psychologistId} не прошло:`, (e as Error).message);
    }
  }

  return { charged, failed };
}
