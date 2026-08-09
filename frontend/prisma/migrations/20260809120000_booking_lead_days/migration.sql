-- Предварительная запись: клиент бронирует окно не позже, чем за N дней.
-- Очно и онлайн настраиваются отдельно — до кабинета нужно доехать.
ALTER TABLE "WorkHours" ADD COLUMN "leadDaysOffline" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorkHours" ADD COLUMN "leadDaysOnline" INTEGER NOT NULL DEFAULT 0;
