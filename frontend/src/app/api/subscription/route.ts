import { NextResponse, type NextRequest } from "next/server";

import { access } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const [sub, acc] = await Promise.all([
      prisma.subscription.findUnique({ where: { psychologistId: user.id }, select: { status: true, plan: true } }),
      access(user.id),
    ]);

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
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
