import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { access } from "@/lib/server/access";
import { MEMBERS_INCLUDE, NEEDS_PRO_MODULE } from "@/lib/server/groups";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const planSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  durationMin: z.number().int().min(15).max(480).default(90),
  /** Сколько недель подряд повторить встречу. 1 — разовая. */
  repeatWeeks: z.number().int().min(1).max(52).default(1),
});

const patchSchema = z.object({
  status: z.enum(["planned", "done", "cancelled"]).optional(),
  attendance: z.array(z.object({ memberId: z.number().int().positive(), present: z.boolean() })).max(60).optional(),
});

async function owned(groupId: number, psychologistId: number) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.psychologistId !== psychologistId) return null;
  return group;
}

const full = (id: number) => prisma.group.findUnique({ where: { id }, include: MEMBERS_INCLUDE });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { startsAt, durationMin, repeatWeeks } = await parseBody(req, planSchema);
    const first = new Date(startsAt);
    // Цикл группы — одна и та же неделя подряд: «по вторникам в 19:00».
    const rows = Array.from({ length: repeatWeeks }, (_, i) => ({
      groupId: group.id,
      startsAt: new Date(first.getTime() + i * 7 * 86_400_000),
      durationMin,
    }));
    await prisma.groupMeeting.createMany({ data: rows });
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
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meetingId = Number(new URL(req.url).searchParams.get("meetingId"));
    const meeting = await prisma.groupMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.groupId !== group.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const patch = await parseBody(req, patchSchema);
    if (patch.status) await prisma.groupMeeting.update({ where: { id: meeting.id }, data: { status: patch.status } });

    if (patch.attendance) {
      // Отметки принимаем только по своим же участникам.
      const own = await prisma.groupMember.findMany({ where: { groupId: group.id }, select: { id: true } });
      const ids = new Set(own.map((m) => m.id));
      const rows = patch.attendance.filter((a) => ids.has(a.memberId));
      await prisma.$transaction([
        prisma.groupAttendance.deleteMany({ where: { meetingId: meeting.id } }),
        prisma.groupAttendance.createMany({ data: rows.map((a) => ({ meetingId: meeting.id, memberId: a.memberId, present: a.present })) }),
      ]);
    }
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
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const { id } = await ctx.params;
    const group = await owned(Number(id), user.id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meetingId = Number(new URL(req.url).searchParams.get("meetingId"));
    await prisma.groupMeeting.deleteMany({ where: { id: meetingId, groupId: group.id } });
    return NextResponse.json(await full(group.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
