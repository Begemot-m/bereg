import { NextResponse, type NextRequest } from "next/server";

import { confirmGate, NEEDS_PRO } from "@/lib/server/access";
import { APPT_CLIENT_SELECT, apptWithPhoto } from "@/lib/server/clients";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { cancelPendingReminders, queueTelegramEvent, replaceReminders } from "@/lib/server/telegram-delivery";
import { APP_ZONE } from "@/lib/server/zone";

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
      format?: string;
      confirm?: boolean;
    };

    if (body.status && !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 422 });
    }
    const startsAt = body.startsAt ? new Date(body.startsAt) : undefined;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "invalid startsAt" }, { status: 422 });
    }

    // Подтверждение записи — единственное место, где платформа берёт деньги за
    // приведённого человека. Пока есть свободные места из трёх бесплатных,
    // подтверждаем молча; когда они кончились, нужна подписка.
    if (body.confirm && !appt.confirmedAt) {
      const gate = await confirmGate(user.id);
      if (!gate.ok) return NextResponse.json(NEEDS_PRO, { status: 402 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.appointment.update({
        where: { id: appt.id },
        data: {
          status: body.status ?? undefined,
          startsAt,
          durationMin: body.durationMin ?? undefined,
          format: body.format === "online" || body.format === "offline" ? body.format : undefined,
          note: body.note ?? undefined,
          ...(startsAt ? { reminderSent: false } : {}),
          // Подтверждаем один раз: повторный PATCH не двигает дату ответа.
          ...(body.confirm && !appt.confirmedAt ? { confirmedAt: new Date() } : {}),
        },
        include: { client: { select: { ...APPT_CLIENT_SELECT, userId: true } } },
      });
      // Подтверждённый человек занимает место в практике: карточка перестаёт
      // быть заявкой и начинает считаться в бесплатном лимите.
      if (body.confirm && !appt.confirmedAt) {
        await tx.client.updateMany({ where: { id: appt.clientId, pending: true }, data: { pending: false } });
      }
      if (body.confirm && !appt.confirmedAt && row.client.userId) {
        await tx.notification.create({
          data: {
            userId: row.client.userId,
            kind: "booking",
            text: `Встреча подтверждена · ${row.startsAt.toLocaleString("ru-RU", { timeZone: APP_ZONE, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`,
          },
        });
        await queueTelegramEvent(tx, { appointmentId: appt.id, recipientId: row.client.userId, audience: "client", kind: "confirm" });
      }
      if (body.status === "cancelled") {
        await cancelPendingReminders(tx, appt.id);
        if (row.client.userId) {
          await queueTelegramEvent(tx, { appointmentId: appt.id, recipientId: row.client.userId, audience: "client", kind: "cancel" });
        }
      } else if (startsAt && startsAt.getTime() !== appt.startsAt.getTime()) {
        const clientUser = row.client.userId
          ? await tx.user.findUnique({ where: { id: row.client.userId }, select: { sessionReminder2h: true } })
          : null;
        if (row.client.userId) {
          await queueTelegramEvent(tx, { appointmentId: appt.id, recipientId: row.client.userId, audience: "client", kind: "reschedule", payload: { previousStartsAt: appt.startsAt.toISOString() } });
        }
        await replaceReminders(tx, {
          appointmentId: appt.id,
          clientUserId: row.client.userId,
          psychologistUserId: user.id,
          startsAt,
          reminder2h: clientUser?.sessionReminder2h ?? false,
        });
      }
      return row;
    });
    return NextResponse.json(apptWithPhoto(updated));
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
