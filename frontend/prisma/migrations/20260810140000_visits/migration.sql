-- Посещаемость: строка на заход в раздел приложения. Аддитивно — прежний код
-- о таблице не знает и продолжает работать.
CREATE TABLE "Visit" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER,
    "role" TEXT NOT NULL DEFAULT 'guest',
    "section" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Visit_createdAt_idx" ON "Visit"("createdAt");
CREATE INDEX "Visit_section_createdAt_idx" ON "Visit"("section", "createdAt");
CREATE INDEX "Visit_device_createdAt_idx" ON "Visit"("device", "createdAt");

ALTER TABLE "Visit" ADD CONSTRAINT "Visit_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
