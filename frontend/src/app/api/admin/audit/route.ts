import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

const PAGE = 30;

/**
 * Журнал действий. Пишется давно, а прочитать его можно было только из базы —
 * то есть в разборе «кто выдал этот PRO» он не участвовал вовсе.
 *
 * Фильтр по действию — по префиксу: `admin.` показывает всё, что делал
 * владелец, `admin.support` — только разбор обращений.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const action = (url.searchParams.get("action") ?? "").trim();
    const userId = Number(url.searchParams.get("userId") ?? "");
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));

    const where = {
      ...(action ? { action: { startsWith: action } } : {}),
      ...(Number.isInteger(userId) && userId > 0 ? { userId } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page * PAGE,
        take: PAGE,
        select: {
          id: true, action: true, entity: true, entityId: true, ip: true,
          meta: true, createdAt: true,
          user: { select: { id: true, username: true, firstName: true } },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pages: Math.ceil(total / PAGE),
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        ip: r.ip,
        meta: r.meta ?? null,
        createdAt: r.createdAt.toISOString(),
        actorId: r.user?.id ?? null,
        actor: r.user ? (r.user.firstName ?? r.user.username ?? `#${r.user.id}`) : "система",
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
