ALTER TABLE "User"
ADD COLUMN "sessionReminder2h" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TelegramDelivery" (
    "id" SERIAL NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "audience" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramDelivery_scheduledFor_sentAt_cancelledAt_idx"
ON "TelegramDelivery"("scheduledFor", "sentAt", "cancelledAt");

CREATE INDEX "TelegramDelivery_appointmentId_kind_idx"
ON "TelegramDelivery"("appointmentId", "kind");

CREATE INDEX "TelegramDelivery_recipientId_createdAt_idx"
ON "TelegramDelivery"("recipientId", "createdAt");

ALTER TABLE "TelegramDelivery"
ADD CONSTRAINT "TelegramDelivery_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TelegramDelivery"
ADD CONSTRAINT "TelegramDelivery_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
