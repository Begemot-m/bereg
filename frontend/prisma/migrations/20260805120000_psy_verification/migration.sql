-- Роль по умолчанию — клиент. Существующие строки не трогаем: у кого есть
-- анкета, тот остаётся психологом, откат кода ничего не ломает.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'client';

-- Верификация психолога живёт на анкете: отдельная сущность заявки не нужна.
ALTER TABLE "PsyProfile" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
ALTER TABLE "PsyProfile" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "PsyProfile" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "PsyProfile" ALTER COLUMN "status" SET DEFAULT 'draft';

-- Анкеты, созданные до появления черновиков, уже считались поданными.
UPDATE "PsyProfile" SET "submittedAt" = "updatedAt" WHERE "status" = 'review' AND "submittedAt" IS NULL;
