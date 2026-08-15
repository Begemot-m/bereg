-- Карточка-пример всем специалистам, а не только новичкам.
-- Релиз sha-6402958 успел проставить `demoClientSeeded = true` тем, у кого уже
-- были клиенты: карточка им не заводилась, а флаг «обработан» остался. Снимаем
-- его у всех, кому пример так и не достался, — при следующем GET /api/clients
-- `ensureDemoClient` заведёт карточку.
--
-- Разовая правка по просьбе владельца: пример получают все, у кого сейчас нет
-- карточки с demo = true, — включая тех, кто её уже удалил. Дальше правило
-- обычное: удалил — больше не появится.
--
-- Выполнять на VPS:
--   cd /opt/bereg
--   docker compose cp reseed-demo-client.sql app:/app/
--   docker compose exec -T app sh -c 'cd /app; npx prisma db execute --schema prisma/schema.prisma --file /app/reseed-demo-client.sql'

UPDATE "User" u
   SET "demoClientSeeded" = false
 WHERE u."demoClientSeeded" = true
   AND NOT EXISTS (SELECT 1 FROM "Client" c WHERE c."psychologistId" = u.id AND c."demo" = true);
