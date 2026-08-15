-- Карточка-пример для нового специалиста.
-- Чисто аддитивно: старый код с этими таблицами работает как раньше,
-- откат образа базу не ломает.
ALTER TABLE "Client" ADD COLUMN "demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "demoClientSeeded" BOOLEAN NOT NULL DEFAULT false;
