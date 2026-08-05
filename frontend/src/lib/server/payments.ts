import { prisma } from "@/lib/server/prisma";

/**
 * Запись платежа в историю. Идемпотентна по `yookassaPaymentId`: один и тот
 * же платёж проводят и вебхук, и автопродление — кто первый, тот и записал.
 *
 * Ошибку глушим: деньги уже списаны и подписка уже продлена, падать здесь —
 * значит просить ЮKassa повторить вебхук ради строки в отчёте.
 */
export async function recordPayment(entry: {
  psychologistId: number;
  yookassaPaymentId: string;
  /** Копейки. */
  amount: number;
  kind: "initial" | "renewal";
  paidAt?: Date;
}) {
  try {
    await prisma.payment.createMany({
      data: [{
        psychologistId: entry.psychologistId,
        yookassaPaymentId: entry.yookassaPaymentId,
        amount: entry.amount,
        kind: entry.kind,
        paidAt: entry.paidAt ?? new Date(),
      }],
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("[payments] не удалось записать платёж", entry.yookassaPaymentId, error);
  }
}
