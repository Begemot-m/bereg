import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { access } from "@/lib/server/access";
import { MEMBERS_INCLUDE, NEEDS_PRO_MODULE, moduleClosed } from "@/lib/server/groups";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const newTaskSchema = z.object({
  text: z.string().trim().min(1, "Напишите задание").max(2000),
  dueAt: z.string().datetime({ offset: true }).nullish(),
});

const patchSchema = z.object({ status: z.enum(["open", "done"]) });

async function owned(groupId: number, psychologistId: number) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.psychologistId !== psychologistId) return null;
  return group;
}

const full = (id: number) => prisma.group.findUnique({ where: { id }, include: MEMBERS_INCLUDE });

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

    const body = await parseBody(req, newTaskSchema);
    await prisma.groupTask.create({
      data: { groupId: group.id, text: body.text, dueAt: body.dueAt ? new Date(body.dueAt) : null },
    });
    return NextResponse.json(await full(group.id), { status: 201 });
  } catch (e) {
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const closed = moduleClosed();
    if (closed) return closed;
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const taskId = Number(new URL(req.url).searchParams.get("taskId"));
    const { status } = await parseBody(req, patchSchema);
    await prisma.groupTask.updateMany({ where: { id: taskId, groupId: group.id }, data: { status } });
    return NextResponse.json(await full(group.id));
  } catch (e) {
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

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

    const taskId = Number(new URL(req.url).searchParams.get("taskId"));
    await prisma.groupTask.deleteMany({ where: { id: taskId, groupId: group.id } });
    return NextResponse.json(await full(group.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
