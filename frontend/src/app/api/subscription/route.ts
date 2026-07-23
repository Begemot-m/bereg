import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const sub = await prisma.subscription.findUnique({ where: { psychologistId: user.id } });

    const now = Date.now();
    const trialEndsAt = new Date(user.createdAt);
    trialEndsAt.setDate(trialEndsAt.getDate() + 10);
    const trialActive = !sub && trialEndsAt.getTime() > now;
    const paidActive = sub?.status === "active" && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > now);
    const status = trialActive ? "trial" : sub?.status === "pending" ? "pending" : paidActive ? "active" : "expired";

    return NextResponse.json({
      plan: sub?.plan ?? "free",
      status,
      trialEndsAt: trialActive ? trialEndsAt.toISOString() : null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      tools: trialActive || paidActive,
      promo: trialActive || (paidActive && sub?.plan === "pro"),
      clientPro: false,
      pendingPlan: sub?.status === "pending" ? "catalog" : null,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
