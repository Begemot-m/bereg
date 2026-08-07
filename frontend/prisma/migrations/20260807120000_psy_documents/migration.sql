-- Документы психолога (диплом, сертификаты) отдельной таблицей. Раньше файл
-- лежал data-URL'ом внутри PsyProfile.data: список анкет в админке тащил
-- мегабайты вложений, а удалить один документ по требованию об удалении ПД
-- можно было только перезаписав весь Json. Миграция только добавляет таблицу —
-- откат кода на прошлый образ базу не ломает, старые анкеты продолжают
-- читаться из Json.
CREATE TABLE IF NOT EXISTS "PsyDocument" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'diploma',
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyDocument_pkey" PRIMARY KEY ("id")
);

-- Ключ хранилища случайный и уникальный: по нему нельзя угадать чужой файл,
-- а повторная запись под тем же именем отвалится сама.
CREATE UNIQUE INDEX IF NOT EXISTS "PsyDocument_storageKey_key" ON "PsyDocument"("storageKey");
CREATE INDEX IF NOT EXISTS "PsyDocument_userId_idx" ON "PsyDocument"("userId");

ALTER TABLE "PsyDocument" ADD CONSTRAINT "PsyDocument_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Старые дипломы из PsyProfile.data сюда не переносим: сам файл лежит в Json
-- как data-URL, а положить его на диск SQL-миграцией нечем. Они продолжают
-- показываться модератору из Json, пока психолог не приложит документ заново.
