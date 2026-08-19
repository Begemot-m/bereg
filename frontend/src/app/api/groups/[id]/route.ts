import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { MEMBERS_INCLUDE, NEEDS_PRO_MODULE } from "@/lib/server/groups";
import { access } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

// Владение проверяем всегда по токену, id из ссылки ему не доверяем.
async function owned(groupId: number, psychologistId: number) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: MEMBERS_INCLUDE });
  if (!group || group.psychologistId !== psychologistId) return null;
  return group;
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  capacity: z.number().int().min(2).max(40).optional(),
  note: z.string().max(4000).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(group);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const patch = await parseBody(req, patchSchema);
    const next = await prisma.group.update({ where: { id: group.id }, data: patch, include: MEMBERS_INCLUDE });
    return NextResponse.json(next);
  } catch (e) {
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.group.delete({ where: { id: group.id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
