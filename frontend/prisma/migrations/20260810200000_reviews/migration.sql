-- Оценки специалистов клиентами.
CREATE TABLE IF NOT EXISTS "Review" (
    "id" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "psychologistId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Review_authorId_psychologistId_key" ON "Review"("authorId", "psychologistId");
CREATE INDEX IF NOT EXISTS "Review_psychologistId_idx" ON "Review"("psychologistId");

ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
