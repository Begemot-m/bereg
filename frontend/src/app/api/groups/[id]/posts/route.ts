import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { access } from "@/lib/server/access";
import { MEMBERS_INCLUDE, NEEDS_PRO_MODULE, announce, moduleClosed } from "@/lib/server/groups";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const postSchema = z.object({ text: z.string().trim().min(1, "Напишите объявление").max(4000) });

async function owned(groupId: number, psychologistId: number) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.psychologistId !== psychologistId) return null;
  return group;
}

const full = (id: number) => prisma.group.findUnique({ where: { id }, include: MEMBERS_INCLUDE });

/** Объявление ведущего: уходит всем участникам разом. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const closed = moduleClosed();
    if (closed) return closed;
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { text } = await parseBody(req, postSchema);
    await announce(group.id, "post", text);
    return NextResponse.json(await full(group.id), { status: 201 });
  } catch (e) {
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

/** Убрать можно только своё объявление: системные события — след истории. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const closed = moduleClosed();
    if (closed) return closed;
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const postId = Number(new URL(req.url).searchParams.get("postId"));
    await prisma.groupPost.deleteMany({ where: { id: postId, groupId: group.id, kind: "post" } });
    return NextResponse.json(await full(group.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
