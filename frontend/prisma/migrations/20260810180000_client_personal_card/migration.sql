-- Личная карточка клиента: психолог у неё может отсутствовать.
ALTER TABLE "Client" ALTER COLUMN "psychologistId" DROP NOT NULL;

-- Имя, под которым клиент подключился, если оно разошлось с подписью психолога.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "joinedName" TEXT;
