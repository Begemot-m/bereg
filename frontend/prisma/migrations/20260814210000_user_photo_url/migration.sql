-- Аватарка из Telegram. Колонка аддитивная и nullable: откат образа на
-- предыдущий релиз базу не ломает.
ALTER TABLE "User" ADD COLUMN "photoUrl" TEXT;
