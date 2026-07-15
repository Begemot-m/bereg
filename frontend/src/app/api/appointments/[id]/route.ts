import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

const STATUSES = ["scheduled", "done", "cancelled"];

async function getOwned(id: number, psychologistId: number) {
  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt || appt.psychologistId !== psychologistId) return null;
  return appt;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const appt = await getOwned(Number(id), user.id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json()) as {
      status?: string;
      startsAt?: string;
      durationMin?: number;
      note?: string;
    };

    if (body.status && !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 422 });
    }
    const startsAt = body.startsAt ? new Date(body.startsAt) : undefined;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "invalid startsAt" }, { status: 422 });
    }

    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: body.status ?? undefined,
        startsAt,
        durationMin: body.durationMin ?? undefined,
        note: body.note ?? undefined,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const appt = await getOwned(Number(id), user.id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.appointment.delete({ where: { id: appt.id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
