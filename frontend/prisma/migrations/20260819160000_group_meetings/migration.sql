-- Встречи группы и посещаемость. Аддитивно: две новые таблицы.
CREATE TABLE "GroupMeeting" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 90,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMeeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupAttendance" (
    "id" SERIAL NOT NULL,
    "meetingId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GroupAttendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GroupMeeting_groupId_startsAt_idx" ON "GroupMeeting"("groupId", "startsAt");
CREATE UNIQUE INDEX "GroupAttendance_meetingId_memberId_key" ON "GroupAttendance"("meetingId", "memberId");

ALTER TABLE "GroupMeeting" ADD CONSTRAINT "GroupMeeting_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupAttendance" ADD CONSTRAINT "GroupAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GroupMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupAttendance" ADD CONSTRAINT "GroupAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GroupMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
