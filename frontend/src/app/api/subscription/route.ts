import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const sub = await prisma.subscription.findUnique({ where: { psychologistId: user.id } });

    // Нет записи — считаем, что психолог на бесплатном плане.
    return NextResponse.json({
      plan: sub?.plan ?? "free",
      status: sub?.status ?? "inactive",
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
