import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Сводка практики за период. Считаем в базе, а не тянем все записи в память:
// у активного психолога их за год тысячи.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 30)));
    const from = new Date();
    from.setDate(from.getDate() - days);

    const where = { psychologistId: user.id, startsAt: { gte: from } };
    const [sessions, done, clientsActive] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.aggregate({
        where: { ...where, status: "done" },
        _count: true,
        _sum: { durationMin: true },
      }),
      prisma.client.count({ where: { psychologistId: user.id, status: "therapy" } }),
    ]);

    return NextResponse.json({
      periodDays: days,
      sessions,
      done: done._count,
      hours: Math.round((done._sum.durationMin ?? 0) / 60),
      clientsActive,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
