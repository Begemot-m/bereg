-- Модуль PRO «Группы и пары»: группа и её состав.
-- Аддитивно: две новые таблицы, существующие данные не трогаются.
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "psychologistId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'group',
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupMember" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Group_psychologistId_status_idx" ON "Group"("psychologistId", "status");
CREATE INDEX "GroupMember_groupId_status_idx" ON "GroupMember"("groupId", "status");
CREATE INDEX "GroupMember_clientId_idx" ON "GroupMember"("clientId");

ALTER TABLE "Group" ADD CONSTRAINT "Group_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
