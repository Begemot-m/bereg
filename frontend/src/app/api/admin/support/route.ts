import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

const select = {
  id: true, topic: true, text: true, contact: true, createdAt: true, handledAt: true,
  user: { select: { id: true, username: true, firstName: true, email: true } },
} as const;

function row(r: {
  id: number; topic: string; text: string; contact: string | null;
  createdAt: Date; handledAt: Date | null;
  user: { id: number; username: string | null; firstName: string | null; email: string | null } | null;
}) {
  return {
    id: r.id,
    topic: r.topic,
    text: r.text,
    contact: r.contact,
    createdAt: r.createdAt.toISOString(),
    handledAt: r.handledAt?.toISOString() ?? null,
    userId: r.user?.id ?? null,
    name: r.user ? (r.user.firstName ?? r.user.username ?? `#${r.user.id}`) : "гость",
    username: r.user?.username ?? null,
    email: r.user?.email ?? null,
  };
}

/**
 * Обращения в поддержку: открытые от самого старого — человек уже ждёт ответа,
 * и порядок «сначала новые» превращает старые в вечно последние.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [open, handled] = await Promise.all([
      prisma.supportRequest.findMany({ where: { handledAt: null }, orderBy: { createdAt: "asc" }, select }),
      prisma.supportRequest.findMany({
        where: { handledAt: { not: null } },
        orderBy: { handledAt: "desc" },
        take: 10,
        select,
      }),
    ]);

    return NextResponse.json({ open: open.map(row), handled: handled.map(row) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
