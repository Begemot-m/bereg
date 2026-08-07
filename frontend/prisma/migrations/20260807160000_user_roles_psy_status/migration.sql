-- Переход с одиночной строки role на массив ролей и отдельный статус
-- верификации. Первый релиз из двух: колонка "role" остаётся на месте и
-- продолжает заполняться, поэтому откат кода на прошлый образ ничего не ломает.
-- Удаление "role" — вторым релизом, когда в проде постоит новый код.
--
-- Зачем массив: один и тот же человек бывает и психологом, и клиентом.
-- Строка заставляла выбирать одно, и переключение кабинетов теряло вторую
-- сторону аккаунта.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roles" TEXT[] NOT NULL DEFAULT ARRAY['client'];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "psyStatus" TEXT NOT NULL DEFAULT 'none';

-- Бэкофилл ролей. Психолог получает обе: клиентская сторона у него была и
-- раньше, просто не помещалась в одну строку.
UPDATE "User" SET "roles" = ARRAY['client', 'psychologist']
 WHERE "role" = 'psychologist' AND NOT ('psychologist' = ANY("roles"));

UPDATE "User" SET "roles" = ARRAY['client']
 WHERE "role" <> 'psychologist' AND "roles" = '{}';

-- Статус верификации тянем из анкеты: она и была источником правды.
UPDATE "User" u SET "psyStatus" = p."status"
  FROM "PsyProfile" p
 WHERE p."userId" = u."id";

-- Быстрый отбор психологов для каталога и статистики: раньше это был
-- фильтр по строке, теперь по массиву — нужен GIN.
CREATE INDEX IF NOT EXISTS "User_roles_idx" ON "User" USING GIN ("roles");
