import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { MEMBERS_INCLUDE, NEEDS_PRO_MODULE } from "@/lib/server/groups";
import { access } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const addSchema = z.object({ clientIds: z.array(z.number().int().positive()).min(1).max(40) });

async function owned(groupId: number, psychologistId: number) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.psychologistId !== psychologistId) return null;
  return group;
}

const withMembers = (id: number) => prisma.group.findUnique({ where: { id }, include: MEMBERS_INCLUDE });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { clientIds } = await parseBody(req, addSchema);
    // Берём только свои карточки: чужой id в теле не должен попадать в состав.
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds }, psychologistId: user.id },
      select: { id: true, name: true },
    });

    const already = await prisma.groupMember.findMany({
      where: { groupId: group.id, status: "active", clientId: { in: clients.map((c) => c.id) } },
      select: { clientId: true },
    });
    const seen = new Set(already.map((m) => m.clientId));
    const fresh = clients.filter((c) => !seen.has(c.id));

    const used = await prisma.groupMember.count({ where: { groupId: group.id, status: "active" } });
    if (used + fresh.length > group.capacity) {
      return NextResponse.json({ error: "no_seats", message: "В группе не хватает мест" }, { status: 409 });
    }

    if (fresh.length) {
      await prisma.groupMember.createMany({
        data: fresh.map((c) => ({ groupId: group.id, clientId: c.id, name: c.name })),
      });
    }
    return NextResponse.json(await withMembers(group.id));
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

    const memberId = Number(new URL(req.url).searchParams.get("memberId"));
    if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

    // Не удаляем, а помечаем ушедшим: посещаемость прошлых встреч должна
    // остаться на месте.
    await prisma.groupMember.updateMany({ where: { id: memberId, groupId: group.id }, data: { status: "left" } });
    return NextResponse.json(await withMembers(group.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
