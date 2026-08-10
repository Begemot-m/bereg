-- Роль, в которой человек работает сейчас: раньше жила только в браузере.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeRole" TEXT NOT NULL DEFAULT 'client';

-- Психологи, закреплённые клиентом в разделе «Терапия».
CREATE TABLE IF NOT EXISTS "TherapistLink" (
    "id" SERIAL NOT NULL,
    "clientUserId" INTEGER NOT NULL,
    "psychologistId" INTEGER NOT NULL,
    "detached" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TherapistLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TherapistLink_clientUserId_psychologistId_key" ON "TherapistLink"("clientUserId", "psychologistId");
CREATE INDEX IF NOT EXISTS "TherapistLink_clientUserId_idx" ON "TherapistLink"("clientUserId");

ALTER TABLE "TherapistLink" ADD CONSTRAINT "TherapistLink_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TherapistLink" ADD CONSTRAINT "TherapistLink_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Роль психолога уже была выбрана раньше — переносим её из roles[].
UPDATE "User" SET "activeRole" = 'psychologist' WHERE 'psychologist' = ANY("roles");
