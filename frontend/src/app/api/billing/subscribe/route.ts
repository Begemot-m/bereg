import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";
import { hit } from "@/lib/server/rate-limit";
import { AuthError, requireUser } from "@/lib/server/session";
import { createPayment } from "@/lib/server/yookassa";

export const runtime = "nodejs";

// Каждое нажатие уходит запросом в API ЮKassa и заводит там платёж. Потолок на
// пользователя, чтобы дребезг кнопки не плодил счета.
const LIMIT = { limit: 10, windowMs: 60_000 };

// Создаёт платёж за подписку Pro и возвращает ссылку на оплату ЮKassa.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!hit(`billing-subscribe:${user.id}`, LIMIT).ok) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const priceRub = Number(process.env.SUBSCRIPTION_PRICE_RUB ?? 990);
    // Адрес возврата берём из APP_URL — того же, что проверяет Origin и знает
    // бот. Отдельный NEXT_PUBLIC_APP_URL на проде отставал и уводил плательщика
    // на отключённый домен.
    const appUrl = env.appUrl;
    const existing = await prisma.subscription.findUnique({ where: { psychologistId: user.id } });

    const payment = await createPayment({
      amountRub: priceRub,
      description: `Подписка Pro — психолог #${user.id}`,
      metadata: { psychologistId: String(user.id), kind: "subscription" },
      savePaymentMethod: true, // сохраняем способ оплаты для рекуррента
      returnUrl: `${appUrl}/billing/return`,
    });

    // Фиксируем ожидание оплаты. Оплаченную подписку в «pending» не роняем:
    // оплата вперёд не должна отбирать PRO на те минуты, пока идёт платёж, —
    // иначе человек с активной подпиской теряет доступ, просто открыв кассу.
    const stillPaid =
      existing?.status === "active" &&
      (!existing.currentPeriodEnd || existing.currentPeriodEnd.getTime() > Date.now());

    await prisma.subscription.upsert({
      where: { psychologistId: user.id },
      create: {
        psychologistId: user.id,
        plan: "pro",
        status: "pending",
        yookassaPaymentId: payment.id,
      },
      update: {
        plan: "pro",
        status: stillPaid ? "active" : "pending",
        yookassaPaymentId: payment.id,
      },
    });

    return NextResponse.json({ confirmation_url: payment.confirmationUrl });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "billing error" },
      { status: 500 },
    );
  }
}
