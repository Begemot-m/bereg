import { NextResponse, type NextRequest } from "next/server";

import { hasCatalogDecline, proPriceFor, PRO_PRICE_RUB } from "@/lib/pricing";
import { access } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const [sub, acc, profile] = await Promise.all([
      prisma.subscription.findUnique({ where: { psychologistId: user.id }, select: { status: true, plan: true } }),
      access(user.id),
      prisma.psyProfile.findUnique({ where: { userId: user.id }, select: { status: true } }),
    ]);
    // Цену считает сервер и он же её выставляет в кассу: кабинету остаётся её
    // показать, а не выводить скидку самому.
    const declined = hasCatalogDecline(profile?.status);

    // «free» — триал ещё впереди: он включится с первой проведённой сессией.
    const status =
      sub?.status === "pending" ? "pending"
      : acc.reason === "trial" ? "trial"
      : acc.pro ? "active"
      : acc.trialStarted || sub ? "expired"
      : "free";

    return NextResponse.json({
      plan: sub?.plan ?? "free",
      status,
      trialEndsAt: acc.trialEndsAt?.toISOString() ?? null,
      trialStarted: acc.trialStarted,
      currentPeriodEnd: acc.currentPeriodEnd,
      pro: acc.pro,
      catalog: acc.catalog,
      catalogUntil: acc.catalogUntil?.toISOString() ?? null,
      pendingPlan: sub?.status === "pending" ? "pro" : null,
      priceRub: proPriceFor(profile?.status),
      // Полная цена нужна только чтобы перечеркнуть её рядом со скидкой.
      fullPriceRub: declined ? PRO_PRICE_RUB : null,
      catalogDeclined: declined,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
