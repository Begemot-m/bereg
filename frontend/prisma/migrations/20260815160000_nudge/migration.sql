-- Догоняющие сообщения: итог недели и возврат тех, кто перестал заходить.
CREATE TABLE "Nudge" (
    "id" SERIAL NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nudge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Nudge_recipientId_kind_periodKey_key" ON "Nudge"("recipientId", "kind", "periodKey");

CREATE INDEX "Nudge_createdAt_idx" ON "Nudge"("createdAt");

ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
