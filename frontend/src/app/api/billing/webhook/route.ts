import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { getPayment } from "@/lib/server/yookassa";

export const runtime = "nodejs";

// Вебхук ЮKassa. Тело клиента не доверяем: берём payment.id и перезапрашиваем
// платёж из API — это и есть проверка подлинности. Обработка идемпотентна.
export async function POST(req: NextRequest) {
  let event: { event?: string; object?: { id?: string } };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const paymentId = event.object?.id;
  if (!paymentId) return NextResponse.json({ ok: true }); // ничего не делаем

  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch {
    // Не смогли подтвердить — просим ЮKassa повторить позже.
    return NextResponse.json({ error: "cannot verify" }, { status: 502 });
  }

  if (!(payment.status === "succeeded" && payment.paid)) {
    return NextResponse.json({ ok: true }); // не оплачено — игнор
  }

  const psychologistId = Number(payment.metadata.psychologistId);
  if (!psychologistId) return NextResponse.json({ ok: true });

  // Идемпотентность: если уже активировали этот платёж — выходим.
  const existing = await prisma.subscription.findUnique({ where: { psychologistId } });
  if (existing?.status === "active" && existing.yookassaPaymentId === paymentId) {
    return NextResponse.json({ ok: true });
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  await prisma.subscription.update({
    where: { psychologistId },
    data: {
      status: "active",
      plan: "pro",
      yookassaPaymentId: paymentId,
      paymentMethodId: payment.paymentMethodId,
      currentPeriodEnd: periodEnd,
    },
  });

  return NextResponse.json({ ok: true });
}
