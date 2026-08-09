import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { createPayment } from "@/lib/server/yookassa";

export const runtime = "nodejs";

// Создаёт платёж за подписку Pro и возвращает ссылку на оплату ЮKassa.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const priceRub = Number(process.env.SUBSCRIPTION_PRICE_RUB ?? 990);
    // Адрес возврата берём из APP_URL — того же, что проверяет Origin и знает
    // бот. Отдельный NEXT_PUBLIC_APP_URL на проде отставал и уводил плательщика
    // на отключённый домен.
    const appUrl = env.appUrl;

    const payment = await createPayment({
      amountRub: priceRub,
      description: `Подписка Pro — психолог #${user.id}`,
      metadata: { psychologistId: String(user.id), kind: "subscription" },
      savePaymentMethod: true, // сохраняем способ оплаты для рекуррента
      returnUrl: `${appUrl}/billing/return`,
    });

    // Фиксируем ожидание оплаты.
    await prisma.subscription.upsert({
      where: { psychologistId: user.id },
      create: {
        psychologistId: user.id,
        plan: "pro",
        status: "pending",
        yookassaPaymentId: payment.id,
      },
      update: { plan: "pro", status: "pending", yookassaPaymentId: payment.id },
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
