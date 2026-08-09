import { Prisma, type PrismaClient } from "@prisma/client";

type DeliveryDb = Pick<Prisma.TransactionClient, "telegramDelivery"> | Pick<PrismaClient, "telegramDelivery">;

const REMINDER_KINDS = ["reminder_24h", "reminder_2h"];

export async function queueTelegramEvent(db: DeliveryDb, input: {
  appointmentId: number;
  recipientId: number;
  audience: "psychologist" | "client";
  kind: "booking" | "reschedule" | "cancel";
  payload?: Record<string, string | number | boolean | null>;
}) {
  await db.telegramDelivery.create({
    data: {
      appointmentId: input.appointmentId,
      recipientId: input.recipientId,
      audience: input.audience,
      kind: input.kind,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      scheduledFor: new Date(),
    },
  });
}

export async function queueHomeworkEvent(db: DeliveryDb, input: {
  homeworkId: number;
  recipientId: number;
  audience: "psychologist" | "client";
  kind: "homework_assigned" | "homework_done";
  payload?: Record<string, string | number | boolean | null>;
}) {
  await db.telegramDelivery.create({
    data: {
      homeworkId: input.homeworkId,
      recipientId: input.recipientId,
      audience: input.audience,
      kind: input.kind,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      scheduledFor: new Date(),
    },
  });
}

/// Пересобирает напоминания по встрече: клиенту за 24 часа (и за 2, если он
/// включил), психологу — за 2 часа до начала. Старые ждущие напоминания гасим,
/// иначе при переносе клиент получит напоминание о прошлом времени.
export async function replaceReminders(db: DeliveryDb, input: {
  appointmentId: number;
  clientUserId: number | null;
  psychologistUserId: number;
  startsAt: Date;
  reminder2h: boolean;
}) {
  const now = new Date();
  await db.telegramDelivery.updateMany({
    where: {
      appointmentId: input.appointmentId,
      kind: { in: REMINDER_KINDS },
      sentAt: null,
      cancelledAt: null,
    },
    data: { cancelledAt: now },
  });

  const candidates: { recipientId: number; audience: string; kind: string; offset: number }[] = [
    { recipientId: input.psychologistUserId, audience: "psychologist", kind: "reminder_2h", offset: 2 * 60 },
  ];
  if (input.clientUserId) {
    candidates.push({ recipientId: input.clientUserId, audience: "client", kind: "reminder_24h", offset: 24 * 60 });
    if (input.reminder2h) {
      candidates.push({ recipientId: input.clientUserId, audience: "client", kind: "reminder_2h", offset: 2 * 60 });
    }
  }

  const rows = candidates
    .map(({ recipientId, audience, kind, offset }) => ({
      appointmentId: input.appointmentId,
      recipientId,
      audience,
      kind,
      scheduledFor: new Date(input.startsAt.getTime() - offset * 60_000),
    }))
    .filter((row) => row.scheduledFor.getTime() > now.getTime());

  if (rows.length) await db.telegramDelivery.createMany({ data: rows });
}

export async function cancelPendingReminders(db: DeliveryDb, appointmentId: number) {
  await db.telegramDelivery.updateMany({
    where: { appointmentId, kind: { in: REMINDER_KINDS }, sentAt: null, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
}
