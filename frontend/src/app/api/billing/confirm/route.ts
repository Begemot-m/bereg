import { NextResponse, type NextRequest } from "next/server";

import { activatePayment, cancelPending } from "@/lib/server/billing";
import { prisma } from "@/lib/server/prisma";
import { hit } from "@/lib/server/rate-limit";
import { AuthError, requireUser } from "@/lib/server/session";
import { getPayment } from "@/lib/server/yookassa";

export const runtime = "nodejs";

// Каждый вызов уходит запросом в API ЮKassa, а страница возврата опрашивает
// эндпоинт по таймеру — потолок на пользователя.
const LIMIT = { limit: 40, windowMs: 60_000 };

/**
 * Проверка своего платежа после возврата с кассы. Вебхук — основной путь, но он
 * приходит на секунды позже, а иногда не приходит вовсе (сеть, настройки
 * магазина). Здесь плательщик сам спрашивает у ЮKassa, что с его платежом, и
 * доступ открывается по тому же коду, что и по вебхуку.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!hit(`billing-confirm:${user.id}`, LIMIT).ok) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }

    const sub = await prisma.subscription.findUnique({ where: { psychologistId: user.id } });
    if (!sub?.yookassaPaymentId) return NextResponse.json({ activated: false });

    const payment = await getPayment(sub.yookassaPaymentId);

    if (payment.status === "canceled") {
      await cancelPending(payment.id, user.id);
      return NextResponse.json({ activated: false, canceled: true });
    }

    const result = await activatePayment(payment, user.id);
    return NextResponse.json({ activated: result === "activated" || result === "already" });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "billing error" },
      { status: 500 },
    );
  }
}
