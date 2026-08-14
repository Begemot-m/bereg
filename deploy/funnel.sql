-- Воронка новых пользователей. Запускать на VPS:
--
--   scp -i ~/.ssh/bereg_vps deploy/funnel.sql root@213.139.208.92:/opt/bereg/
--   ssh -i ~/.ssh/bereg_vps root@213.139.208.92 \
--     'cd /opt/bereg && docker run --rm --network host --env-file .env -v /opt/bereg:/w postgres:16-alpine \
--        sh -c '\''psql "${DATABASE_URL%%\?*}" -f /w/funnel.sql'\'''
--
-- Окно когорты — двое суток; поменять в CTE `cohort` ниже.

\pset border 2
\timing off

\echo '== 1. Приход по дням (14 дней) =='
SELECT date_trunc('day', "createdAt")::date AS день,
       count(*)                                                        AS всего,
       count(*) FILTER (WHERE 'psychologist' = ANY(roles))             AS назвались_специалистом,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Client" c
                                      WHERE c."userId" = u.id AND c."invitedAt" IS NOT NULL)) AS по_приглашению
FROM "User" u
WHERE "deletedAt" IS NULL AND "createdAt" > now() - interval '14 days'
GROUP BY 1 ORDER BY 1 DESC;

\echo '== 2. Воронка когорты за 2 суток =='
WITH cohort AS (
  SELECT id, "createdAt", roles FROM "User"
  WHERE "deletedAt" IS NULL AND "createdAt" > now() - interval '2 days'
)
SELECT
  count(*)                                                                      AS вошли,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Consent" k WHERE k."userId" = n.id))
                                                                                AS дошли_до_конца_знакомства,
  count(*) FILTER (WHERE 'psychologist' = ANY(n.roles))                         AS ветка_специалиста,
  count(*) FILTER (WHERE NOT ('psychologist' = ANY(n.roles)))                   AS ветка_клиента,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Visit" v
                                 WHERE v."userId" = n.id AND v.section <> 'home'))
                                                                                AS ушли_дальше_главной,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Visit" v
                                 WHERE v."userId" = n.id AND v.section IN ('catalog','therapy')))
                                                                                AS искали_специалиста,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "TherapistLink" t WHERE t."clientUserId" = n.id))
                                                                                AS закрепили_специалиста,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Client" c JOIN "Appointment" a ON a."clientId" = c.id
                                 WHERE c."userId" = n.id))                      AS записались_на_сессию,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "PsyProfile" p WHERE p."userId" = n.id))
                                                                                AS завели_анкету,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "PsyProfile" p
                                 WHERE p."userId" = n.id AND p."submittedAt" IS NOT NULL))
                                                                                AS подали_на_проверку
FROM cohort n;

\echo '== 3. Последний экран перед уходом (когорта 2 суток) =='
WITH cohort AS (
  SELECT id FROM "User" WHERE "deletedAt" IS NULL AND "createdAt" > now() - interval '2 days'
),
last_visit AS (
  SELECT DISTINCT ON (v."userId") v."userId", v.section, v.role
  FROM "Visit" v JOIN cohort n ON n.id = v."userId"
  ORDER BY v."userId", v."createdAt" DESC
)
SELECT role AS роль, section AS последний_раздел, count(*) AS человек
FROM last_visit GROUP BY 1, 2 ORDER BY 3 DESC;

\echo '== 4. Глубина захода: сколько разных разделов открыл человек =='
WITH cohort AS (
  SELECT id FROM "User" WHERE "deletedAt" IS NULL AND "createdAt" > now() - interval '2 days'
),
depth AS (
  SELECT n.id, count(DISTINCT v.section) AS sections
  FROM cohort n LEFT JOIN "Visit" v ON v."userId" = n.id
  GROUP BY n.id
)
SELECT sections AS разделов_открыто, count(*) AS человек
FROM depth GROUP BY 1 ORDER BY 1;

\echo '== 5. Вернулись ли (второй заход позже часа / на другой день) =='
WITH cohort AS (
  SELECT id, "createdAt" FROM "User" WHERE "deletedAt" IS NULL AND "createdAt" > now() - interval '2 days'
),
span AS (
  SELECT n.id, min(v."createdAt") AS first_v, max(v."createdAt") AS last_v,
         count(DISTINCT date_trunc('day', v."createdAt")) AS days
  FROM cohort n LEFT JOIN "Visit" v ON v."userId" = n.id
  GROUP BY n.id
)
SELECT count(*)                                                    AS всего,
       count(*) FILTER (WHERE last_v - first_v > interval '5 min') AS сидели_дольше_5_минут,
       count(*) FILTER (WHERE last_v - first_v > interval '1 hour')AS возвращались_позже_часа,
       count(*) FILTER (WHERE days > 1)                            AS заходили_в_разные_дни
FROM span;

\echo '== 6. Гости без входа (в мини-приложении вход автоматический — это веб/лендинг) =='
SELECT date_trunc('day', "createdAt")::date AS день,
       section AS раздел, count(DISTINCT device) AS устройств, count(*) AS заходов
FROM "Visit"
WHERE "userId" IS NULL AND "createdAt" > now() - interval '7 days'
GROUP BY 1, 2 ORDER BY 1 DESC, 4 DESC;

\echo '== 7. Что вообще есть в каталоге =='
SELECT p.status AS статус_анкеты,
       count(*) AS анкет,
       count(*) FILTER (WHERE p."reviewedAt" > now() - interval '14 days') AS в_бесплатном_окне,
       count(*) FILTER (WHERE s.status = 'active'
                          AND (s."currentPeriodEnd" IS NULL OR s."currentPeriodEnd" > now())) AS с_оплаченным_pro
FROM "PsyProfile" p
LEFT JOIN "Subscription" s ON s."psychologistId" = p."userId"
GROUP BY 1 ORDER BY 2 DESC;

\echo '== 8. Деньги =='
SELECT count(*) FILTER (WHERE status = 'active' AND "grantedBy" IS NULL)  AS платных_подписок,
       count(*) FILTER (WHERE status = 'active' AND "grantedBy" IS NOT NULL) AS выдано_вручную,
       count(*) FILTER (WHERE status = 'pending')                         AS начали_оплату_и_не_дошли
FROM "Subscription";

SELECT date_trunc('day', "paidAt")::date AS день, count(*) AS платежей, sum(amount)/100 AS рублей
FROM "Payment" WHERE "paidAt" > now() - interval '30 days'
GROUP BY 1 ORDER BY 1 DESC;
