-- Лента группы: объявления ведущего и системные события (перенос, отмена,
-- новая встреча). Аддитивно: одна новая таблица.
CREATE TABLE "GroupPost" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'post',
    "text" TEXT NOT NULL,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GroupPost_groupId_createdAt_idx" ON "GroupPost"("groupId", "createdAt");

ALTER TABLE "GroupPost" ADD CONSTRAINT "GroupPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
