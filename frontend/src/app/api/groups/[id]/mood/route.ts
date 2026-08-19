import { NextResponse, type NextRequest } from "next/server";

import { access } from "@/lib/server/access";
import { NEEDS_PRO_MODULE, moduleClosed } from "@/lib/server/groups";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

/** За сколько недель показываем динамику — столько же, сколько рисует вкладка. */
const WEEKS = 6;

/**
 * Динамика состояний участников: их дневники настроения, собранные по группе
 * одним запросом. Участник без карточки клиента отдаётся с пустым рядом —
 * место в группе может занимать и просто имя.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const closed = moduleClosed();
    if (closed) return closed;
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await prisma.group.findUnique({ where: { id: Number(id) } });
    if (!group || group.psychologistId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const members = await prisma.groupMember.findMany({
      where: { groupId: group.id, status: "active" },
      orderBy: { joinedAt: "asc" },
      select: { id: true, name: true, clientId: true },
    });

    const since = new Date(Date.now() - WEEKS * 7 * 86_400_000);
    const clientIds = members.map((m) => m.clientId).filter((v): v is number => v !== null);
    const moods = clientIds.length
      ? await prisma.mood.findMany({
          where: { clientId: { in: clientIds }, day: { gte: since } },
          orderBy: { day: "asc" },
          select: { clientId: true, day: true, mood: true },
        })
      : [];

    return NextResponse.json(members.map((m) => ({
      memberId: m.id,
      name: m.name,
      photo: null,
      rows: moods.filter((r) => r.clientId === m.clientId).map((r) => ({ date: r.day.toISOString(), mood: r.mood })),
    })));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
