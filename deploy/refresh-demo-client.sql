-- Пересев демо-карточки после правок содержимого (релиз «Анна (демо)»).
-- Старая карточка называлась «Анна (пример)», без фото, без заметок о встречах
-- и с другой доской. Обновлять её по месту нечем: содержимое шифруется ключом
-- приложения, а строки заданий и заметок заводятся кодом. Поэтому удаляем
-- демо-карточки целиком (каскадом уходят встречи, задания, настроение, колесо)
-- и снимаем флаг у тех, у кого она была, — при следующем GET /api/clients
-- `ensureDemoClient` заведёт новую.
--
-- Тех, кто демо-карточку уже удалил сам, правка не трогает: у них флаг стоит,
-- а карточки нет — она и не вернётся.
--
-- Выполнять на VPS:
--   cd /opt/bereg
--   docker compose cp refresh-demo-client.sql app:/app/
--   docker compose exec -T app sh -c 'cd /app; npx prisma db execute --schema prisma/schema.prisma --file /app/refresh-demo-client.sql'

WITH removed AS (
  DELETE FROM "Client" WHERE "demo" = true RETURNING "psychologistId"
)
UPDATE "User"
   SET "demoClientSeeded" = false
 WHERE id IN (SELECT "psychologistId" FROM removed WHERE "psychologistId" IS NOT NULL);
