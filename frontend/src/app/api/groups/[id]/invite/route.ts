import { NextResponse, type NextRequest } from "next/server";

import { access } from "@/lib/server/access";
import { NEEDS_PRO_MODULE, moduleClosed } from "@/lib/server/groups";
import { inviteCode } from "@/lib/server/invite-code";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Ссылка на набор в группу — одна на всю группу и без срока. Её кладут в чат
 * набора и в описание анонса, поэтому именных кодов на каждого участника тут
 * нет: пришедший занимает свободное место сам.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const closed = moduleClosed();
    if (closed) return closed;
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await prisma.group.findUnique({ where: { id: Number(id) }, select: { id: true, psychologistId: true } });
    if (!group || group.psychologistId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ token: await inviteCode("group", group.id) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
