import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

/** Запись принадлежит этому клиенту? id из пути сам по себе ничего не даёт. */
async function myAppointment(id: number, userId: number) {
  const appt = await prisma.appointment.findUnique({ where: { id }, include: { client: { select: { userId: true } } } });
  return appt && appt.client.userId === userId ? appt : null;
}

// Перенос.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const appt = await myAppointment(Number(id), user.id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json()) as { startsAt?: string };
    const startsAt = new Date(String(body.startsAt));
    if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ error: "invalid startsAt" }, { status: 422 });

    const busy = await prisma.appointment.findFirst({
      where: { psychologistId: appt.psychologistId, startsAt, status: { not: "cancelled" }, id: { not: appt.id } },
    });
    if (busy) return NextResponse.json({ error: "Слот уже занят" }, { status: 409 });

    const updated = await prisma.appointment.update({ where: { id: appt.id }, data: { startsAt } });
    return NextResponse.json({
      id: updated.id,
      startsAt: updated.startsAt.toISOString(),
      durationMin: updated.durationMin,
      format: updated.format,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

// Отмена. Запись не удаляем: она нужна психологу в истории и в статистике.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const appt = await myAppointment(Number(id), user.id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.appointment.update({ where: { id: appt.id }, data: { status: "cancelled" } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
