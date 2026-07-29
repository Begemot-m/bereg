import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

const PAGE = 25;

/** Список пользователей с поиском и постраничной выдачей. */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));

    const where = q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" as const } },
            { firstName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page * PAGE,
        take: PAGE,
        select: {
          id: true, username: true, firstName: true, email: true, role: true,
          isAdmin: true, blockedAt: true, deletedAt: true, createdAt: true,
          subscription: { select: { status: true, plan: true, currentPeriodEnd: true, grantedBy: true } },
          _count: { select: { clients: true, appointments: true } },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pages: Math.ceil(total / PAGE),
      items: rows.map((u) => ({
        id: u.id,
        name: u.firstName ?? u.username ?? `#${u.id}`,
        username: u.username,
        email: u.email,
        role: u.role,
        isAdmin: u.isAdmin,
        blocked: Boolean(u.blockedAt),
        deleted: Boolean(u.deletedAt),
        createdAt: u.createdAt.toISOString(),
        pro: u.subscription?.status === "active",
        proUntil: u.subscription?.currentPeriodEnd?.toISOString() ?? null,
        proGranted: Boolean(u.subscription?.grantedBy),
        clients: u._count.clients,
        appointments: u._count.appointments,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
