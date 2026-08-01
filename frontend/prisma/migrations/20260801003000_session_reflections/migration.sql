CREATE TABLE "SessionReflection" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "preparation" TEXT NOT NULL DEFAULT '',
    "takeaway" TEXT NOT NULL DEFAULT '',
    "feeling" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionReflection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionReflection_appointmentId_key"
ON "SessionReflection"("appointmentId");

CREATE INDEX "SessionReflection_clientId_updatedAt_idx"
ON "SessionReflection"("clientId", "updatedAt");

ALTER TABLE "SessionReflection"
ADD CONSTRAINT "SessionReflection_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionReflection"
ADD CONSTRAINT "SessionReflection_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
