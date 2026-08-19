-- Карточка группы: формат встреч, место, внешний ресурс, информация для
-- участников, напоминания и задания. Аддитивно: колонки с умолчаниями и одна
-- новая таблица.
ALTER TABLE "Group" ADD COLUMN "about" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Group" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'offline';
ALTER TABLE "Group" ADD COLUMN "place" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Group" ADD COLUMN "resourceUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Group" ADD COLUMN "remind24h" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Group" ADD COLUMN "remind2h" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "GroupMeeting" ADD COLUMN "format" TEXT;
ALTER TABLE "GroupMeeting" ADD COLUMN "place" TEXT;

CREATE TABLE "GroupTask" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GroupTask_groupId_status_idx" ON "GroupTask"("groupId", "status");

ALTER TABLE "GroupTask" ADD CONSTRAINT "GroupTask_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
