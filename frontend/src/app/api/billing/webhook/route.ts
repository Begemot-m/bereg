import { NextResponse, type NextRequest } from "next/server";

import { recordPayment } from "@/lib/server/payments";
import { prisma } from "@/lib/server/prisma";
import { hit } from "@/lib/server/rate-limit";
import { getPayment } from "@/lib/server/yookassa";

export const runtime = "nodejs";

// Вебхук ЮKassa. Тело клиента не доверяем: берём payment.id и перезапрашиваем
// платёж из API — это и есть проверка подлинности. Обработка идемпотентна.
//
// Проверки Origin у него нет (ЮKassa его не шлёт), так что дёрнуть роут может
// кто угодно, и каждый вызов уходит запросом в API ЮKassa. Подделать оплату
// так нельзя, но выжечь их квоту и занять воркеры — вполне, поэтому потолок
// общий на весь эндпоинт, а не по адресу: у ЮKassa адреса свои и меняются.
const WEBHOOK_LIMIT = { limit: 120, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  if (!hit("yookassa-webhook", WEBHOOK_LIMIT).ok) {
    // 503 просит ЮKassa повторить позже — их вебхук переживает это спокойно.
    return NextResponse.json({ error: "busy" }, { status: 503 });
  }

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

  // Пишем платёж до проверки на повтор: подписку мог продлить автопродление,
  // и тогда выход по идемпотентности случится раньше, чем деньги попадут в
  // историю. Сама запись идемпотентна по id платежа.
  await recordPayment({
    psychologistId,
    yookassaPaymentId: paymentId,
    amount: payment.amount,
    kind: payment.metadata.kind === "renewal" ? "renewal" : "initial",
  });

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
