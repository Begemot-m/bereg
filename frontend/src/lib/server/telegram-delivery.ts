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

export async function replaceClientReminders(db: DeliveryDb, input: {
  appointmentId: number;
  clientUserId: number;
  startsAt: Date;
  reminder2h: boolean;
}) {
  const now = new Date();
  await db.telegramDelivery.updateMany({
    where: {
      appointmentId: input.appointmentId,
      audience: "client",
      kind: { in: REMINDER_KINDS },
      sentAt: null,
      cancelledAt: null,
    },
    data: { cancelledAt: now },
  });

  const candidates = [
    { kind: "reminder_24h", offset: 24 * 60 },
    ...(input.reminder2h ? [{ kind: "reminder_2h", offset: 2 * 60 }] : []),
  ];
  const rows = candidates
    .map(({ kind, offset }) => ({
      appointmentId: input.appointmentId,
      recipientId: input.clientUserId,
      audience: "client",
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
