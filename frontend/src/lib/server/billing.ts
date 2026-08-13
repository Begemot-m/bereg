import { recordPayment } from "@/lib/server/payments";
import { prisma } from "@/lib/server/prisma";
import type { PaymentDetails } from "@/lib/server/yookassa";

const DAY = 86_400_000;
const PERIOD_DAYS = 30;

/**
 * Докуда действует подписка после оплаты. Если прошлый период ещё не кончился,
 * новые 30 дней приклеиваются к остатку: оплата вперёд не должна сжигать то,
 * за что человек уже заплатил.
 */
export function nextPeriodEnd(currentEnd: Date | null | undefined, now = new Date()): Date {
  return extendPeriod(currentEnd, PERIOD_DAYS, now);
}

/**
 * То же правило для произвольного числа дней: им пользуется подарок из админки,
 * чтобы выданный доступ считался ровно как оплата — с остатком, а не вместо него.
 */
export function extendPeriod(currentEnd: Date | null | undefined, days: number, now = new Date()): Date {
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  return new Date(base.getTime() + days * DAY);
}

export type Activation = "activated" | "already" | "not_paid" | "foreign";

/**
 * Проводит платёж ЮKassa: пишет строку в историю и открывает PRO. Один и тот же
 * платёж приходит и вебхуком, и проверкой на странице возврата, поэтому вызов
 * идемпотентен по `yookassaPaymentId`.
 *
 * `expectedUserId` задаётся, когда платёж проверяет сам плательщик: чужой
 * идентификатор в metadata не должен открывать доступ тому, кто его прислал.
 */
export async function activatePayment(
  payment: PaymentDetails,
  expectedUserId?: number,
): Promise<Activation> {
  if (!(payment.status === "succeeded" && payment.paid)) return "not_paid";

  const psychologistId = Number(payment.metadata.psychologistId);
  if (!psychologistId) return "foreign";
  if (expectedUserId && psychologistId !== expectedUserId) return "foreign";

  // Платёж в историю пишем до проверки на повтор: подписку мог продлить
  // автопродление, и тогда выход по идемпотентности случился бы раньше, чем
  // деньги попали в отчёт. Сама запись идемпотентна по id платежа.
  await recordPayment({
    psychologistId,
    yookassaPaymentId: payment.id,
    amount: payment.amount,
    kind: payment.metadata.kind === "renewal" ? "renewal" : "initial",
  });

  const existing = await prisma.subscription.findUnique({ where: { psychologistId } });
  if (existing?.status === "active" && existing.yookassaPaymentId === payment.id) return "already";

  const data = {
    plan: "pro",
    status: "active",
    yookassaPaymentId: payment.id,
    currentPeriodEnd: nextPeriodEnd(existing?.currentPeriodEnd),
    // Способ оплаты сохраняем только когда ЮKassa его прислала: у рекуррентного
    // списания его может не быть, а затирать сохранённый нельзя — иначе
    // следующее автопродление списывать будет нечем.
    ...(payment.paymentMethodId ? { paymentMethodId: payment.paymentMethodId } : {}),
  };

  await prisma.subscription.upsert({
    where: { psychologistId },
    create: { psychologistId, ...data },
    update: data,
  });

  return "activated";
}

/**
 * Платёж отменён или не прошёл: снимаем ожидание оплаты, чтобы кабинет не
 * показывал «ждём подтверждения» бесконечно. Активную подписку не трогаем —
 * отменённый платёж вперёд не должен отбирать уже оплаченный период.
 */
export async function cancelPending(paymentId: string, psychologistId: number): Promise<void> {
  await prisma.subscription.updateMany({
    where: { psychologistId, status: "pending", yookassaPaymentId: paymentId },
    data: { status: "inactive" },
  });
}
