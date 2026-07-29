import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Сводка платформы. Считаем агрегатами: на паре сотен пользователей это
 * доли миллисекунды, а тянуть таблицы в память ради счётчиков незачем.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);

    const [
      users, newWeek, psychologists, blocked,
      subsActive, subsGranted, subsPending,
      clients, appts, apptsMonth,
      support,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { deletedAt: null, role: "psychologist" } }),
      prisma.user.count({ where: { blockedAt: { not: null } } }),
      prisma.subscription.count({ where: { status: "active", grantedBy: null } }),
      prisma.subscription.count({ where: { status: "active", grantedBy: { not: null } } }),
      prisma.subscription.count({ where: { status: "pending" } }),
      prisma.client.count(),
      prisma.appointment.count({ where: { status: { not: "cancelled" } } }),
      prisma.appointment.count({ where: { status: { not: "cancelled" }, startsAt: { gte: monthAgo } } }),
      prisma.supportRequest.count({ where: { handledAt: null } }),
    ]);

    // Активные — те, кто за неделю хоть что-то делал. Считаем по живым
    // сессиям: это дешевле, чем заводить отдельную таблицу событий.
    const activeWeek = await prisma.session.findMany({
      where: { lastUsedAt: { gte: weekAgo }, revokedAt: null },
      select: { userId: true },
      distinct: ["userId"],
    });

    return NextResponse.json({
      users: { total: users, newWeek, psychologists, blocked, activeWeek: activeWeek.length },
      subscriptions: { paid: subsActive, granted: subsGranted, pending: subsPending },
      usage: { clients, appointments: appts, appointmentsMonth: apptsMonth },
      support: { open: support },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
