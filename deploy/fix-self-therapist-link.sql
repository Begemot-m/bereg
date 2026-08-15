-- Разовая чистка после бага «специалист привязался к собственному приглашению».
-- Переход по своей же ссылке заводил у психолога карточку с его же userId и
-- связь «сам себе терапевт»; карточку он потом удалял руками, а связь
-- оставалась — специалист висел у себя в «Терапии».
--
-- Код это больше не создаёт (проверки в /api/invite/accept и /api/clients/join,
-- открепление при удалении карточки), но старые строки надо убрать.
--
-- Выполнять на VPS:
--   cd /opt/bereg
--   docker compose exec -T app sh -c 'cd /app; npx prisma db execute --schema prisma/schema.prisma --file /app/fix-self-therapist-link.sql'
-- (файл предварительно положить в контейнер: docker compose cp fix-self-therapist-link.sql app:/app/)

DELETE FROM "TherapistLink" WHERE "clientUserId" = "psychologistId";

UPDATE "Client"
   SET "userId" = NULL, link = 'none', "joinedName" = NULL
 WHERE "userId" IS NOT NULL
   AND "userId" = "psychologistId";
