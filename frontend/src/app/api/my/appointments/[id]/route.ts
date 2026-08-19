import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { checkSlotOpen, lockedByPolicy } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";
import { cancelPendingReminders, queueTelegramEvent, replaceReminders } from "@/lib/server/telegram-delivery";
import { APP_ZONE } from "@/lib/server/zone";

export const runtime = "nodejs";

/** Запись принадлежит этому клиенту? id из пути сам по себе ничего не даёт. */
async function myAppointment(id: number, userId: number) {
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: { select: { userId: true } },
      psychologist: { select: { workHours: { select: { cancelLockDays: true } } } },
    },
  });
  return appt && appt.client.userId === userId ? appt : null;
}

// Перенос.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const appt = await myAppointment(Number(id), user.id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const lockDays = appt.psychologist.workHours?.cancelLockDays ?? 0;
    if (lockedByPolicy(appt.startsAt, lockDays)) {
      return NextResponse.json({ error: `Перенести можно не позже чем за ${lockDays} дн. до встречи` }, { status: 409 });
    }

    const body = (await req.json()) as { startsAt?: string };
    const startsAt = new Date(String(body.startsAt));
    if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ error: "invalid startsAt" }, { status: 422 });

    // Перенос — та же запись, только в другое окно: правила приёма действуют
    // и здесь. Иначе запрет обходится в два касания — отменить нельзя, а
    // сдвинуть в закрытый день можно.
    const open = await checkSlotOpen(appt.psychologistId, startsAt, appt.id);
    if (!open.ok) {
      if (open.reason === "taken") return NextResponse.json({ error: "Слот уже занят" }, { status: 409 });
      if (open.reason === "lead") {
        return NextResponse.json(
          { error: `Записаться можно не позже чем за ${open.leadDays} дн. до встречи` },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Это время закрыто для записи. Выберите другое окно" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Новое время — новое согласие: перенос снимает подтверждение.
      const row = await tx.appointment.update({ where: { id: appt.id }, data: { startsAt, reminderSent: false, confirmedAt: null } });
      await queueTelegramEvent(tx, { appointmentId: appt.id, recipientId: appt.psychologistId, audience: "psychologist", kind: "reschedule", payload: { previousStartsAt: appt.startsAt.toISOString() } });
      await queueTelegramEvent(tx, { appointmentId: appt.id, recipientId: user.id, audience: "client", kind: "reschedule", payload: { previousStartsAt: appt.startsAt.toISOString() } });
      await replaceReminders(tx, { appointmentId: appt.id, clientUserId: user.id, psychologistUserId: appt.psychologistId, startsAt, reminder2h: user.sessionReminder2h });
      await tx.notification.create({ data: { userId: appt.psychologistId, kind: "reschedule", text: `Клиент перенёс встречу на ${startsAt.toLocaleString("ru-RU", { timeZone: APP_ZONE })}. Подтвердите новое время в приложении.` } });
      return row;
    });
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

    const lockDays = appt.psychologist.workHours?.cancelLockDays ?? 0;
    if (lockedByPolicy(appt.startsAt, lockDays)) {
      return NextResponse.json({ error: `Отменить можно не позже чем за ${lockDays} дн. до встречи` }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id: appt.id }, data: { status: "cancelled" } });
      await cancelPendingReminders(tx, appt.id);
      await queueTelegramEvent(tx, { appointmentId: appt.id, recipientId: appt.psychologistId, audience: "psychologist", kind: "cancel" });
      await queueTelegramEvent(tx, { appointmentId: appt.id, recipientId: user.id, audience: "client", kind: "cancel" });
      await tx.notification.create({ data: { userId: appt.psychologistId, kind: "cancel", text: `Клиент отменил встречу ${appt.startsAt.toLocaleString("ru-RU", { timeZone: APP_ZONE })}` } });
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
