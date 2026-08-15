import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { buildFunnel } from "@/lib/server/funnel";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Удержание: возвращаются ли люди.
 *
 * Воронка рядом отвечает на другой вопрос — как далеко человек прошёл за
 * первый раз. Она может быть зелёной, пока все уходят после первого захода.
 * Здесь считаем именно возвраты: по устройству (гость каталога не
 * авторизован, но он такой же посетитель) и по факту работы специалиста.
 *
 * Данные — таблица заходов. Она пишется не с первого дня платформы, поэтому
 * в ответе есть `since`: без него первые недели выглядят как провал.
 */

type Stick = { dau: number; wau: number; mau: number; repeat30: number; once30: number };
type Cohort = { week: string; people: number; w1: number; w2: number; w3: number; w4: number };
type Life = { registered: number; returned: number; withClient: number; withSession: number; active28: number };
type Sleep = { psychologists: number; clients: number };

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

function startOfMskDay(now = new Date()): Date {
  const msk = new Date(now.getTime() + MSK_OFFSET_MS);
  msk.setUTCHours(0, 0, 0, 0);
  return new Date(msk.getTime() - MSK_OFFSET_MS);
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const dayStart = startOfMskDay();

    const [stick, cohorts, life, sleep, first] = await Promise.all([
      prisma.$queryRaw<Stick[]>`
        SELECT
          (SELECT count(DISTINCT "device") FROM "Visit" WHERE "createdAt" >= ${dayStart})::int AS dau,
          (SELECT count(DISTINCT "device") FROM "Visit" WHERE "createdAt" >= now() - interval '7 days')::int AS wau,
          (SELECT count(DISTINCT "device") FROM "Visit" WHERE "createdAt" >= now() - interval '30 days')::int AS mau,
          (SELECT count(*) FROM (
             SELECT "device" FROM "Visit" WHERE "createdAt" >= now() - interval '30 days'
              GROUP BY "device" HAVING count(DISTINCT date_trunc('day', "createdAt")) > 1) t)::int AS repeat30,
          (SELECT count(*) FROM (
             SELECT "device" FROM "Visit" WHERE "createdAt" >= now() - interval '30 days'
              GROUP BY "device" HAVING count(DISTINCT date_trunc('day', "createdAt")) = 1) t)::int AS once30`,

      // Когорты по неделе первого захода: сколько из пришедших тогда
      // возвращались на первой, второй, третьей и четвёртой неделе после.
      prisma.$queryRaw<Cohort[]>`
        WITH firsts AS (
          SELECT "device", min("createdAt") AS first_at FROM "Visit" GROUP BY "device"
        ),
        cohort AS (
          SELECT "device", date_trunc('week', first_at) AS week FROM firsts
           WHERE first_at >= date_trunc('week', now()) - interval '8 weeks'
             AND first_at < date_trunc('week', now())
        )
        SELECT to_char(c.week, 'YYYY-MM-DD') AS week,
               count(*)::int AS people,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Visit" v WHERE v."device" = c."device"
                 AND v."createdAt" >= c.week + interval '1 week' AND v."createdAt" < c.week + interval '2 weeks'))::int AS w1,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Visit" v WHERE v."device" = c."device"
                 AND v."createdAt" >= c.week + interval '2 weeks' AND v."createdAt" < c.week + interval '3 weeks'))::int AS w2,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Visit" v WHERE v."device" = c."device"
                 AND v."createdAt" >= c.week + interval '3 weeks' AND v."createdAt" < c.week + interval '4 weeks'))::int AS w3,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Visit" v WHERE v."device" = c."device"
                 AND v."createdAt" >= c.week + interval '4 weeks' AND v."createdAt" < c.week + interval '5 weeks'))::int AS w4
          FROM cohort c GROUP BY 1 ORDER BY 1 DESC`,

      // Жизнь специалиста после регистрации. Последняя ступень — главная:
      // сколько из дошедших до практики ведут её сейчас, а не когда-то.
      prisma.$queryRaw<Life[]>`
        SELECT count(*)::int AS registered,
               (count(*) FILTER (WHERE t.days >= 2))::int AS returned,
               (count(*) FILTER (WHERE t.clients > 0))::int AS "withClient",
               (count(*) FILTER (WHERE t.held > 0))::int AS "withSession",
               (count(*) FILTER (WHERE t.held28 > 0))::int AS "active28"
          FROM (
            SELECT u.id,
              (SELECT count(DISTINCT date_trunc('day', v."createdAt")) FROM "Visit" v WHERE v."userId" = u.id) AS days,
              (SELECT count(*) FROM "Client" c WHERE c."psychologistId" = u.id AND c.demo = false) AS clients,
              (SELECT count(*) FROM "Appointment" a WHERE a."psychologistId" = u.id AND a.status = 'done') AS held,
              (SELECT count(*) FROM "Appointment" a WHERE a."psychologistId" = u.id AND a.status = 'done'
                 AND a."startsAt" >= now() - interval '28 days') AS held28
              FROM "User" u
             WHERE u."deletedAt" IS NULL AND 'psychologist' = ANY(u."roles")
          ) t`,

      // Спящие: заходили и перестали. Тот, кто не заходил ни разу, — это
      // вопрос к воронке, а не к удержанию, и сюда не попадает.
      prisma.$queryRaw<Sleep[]>`
        SELECT (count(*) FILTER (WHERE t.psy))::int AS psychologists,
               (count(*) FILTER (WHERE NOT t.psy))::int AS clients
          FROM (
            SELECT 'psychologist' = ANY(u."roles") AS psy,
                   (SELECT max(v."createdAt") FROM "Visit" v WHERE v."userId" = u.id) AS last_visit
              FROM "User" u WHERE u."deletedAt" IS NULL AND u."blockedAt" IS NULL
          ) t
         WHERE t.last_visit IS NOT NULL AND t.last_visit < now() - interval '14 days'`,

      prisma.visit.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]);

    const s = stick[0] ?? { dau: 0, wau: 0, mau: 0, repeat30: 0, once30: 0 };
    const l = life[0] ?? { registered: 0, returned: 0, withClient: 0, withSession: 0, active28: 0 };
    const seen = s.repeat30 + s.once30;

    return NextResponse.json({
      stickiness: {
        ...s,
        /** Доля дневной аудитории в месячной: как часто вообще возвращаются. */
        ratio: s.mau > 0 ? Math.round((s.dau / s.mau) * 100) : 0,
        repeatShare: seen > 0 ? Math.round((s.repeat30 / seen) * 100) : 0,
      },
      cohorts: cohorts.map((c) => ({
        ...c,
        shares: [c.w1, c.w2, c.w3, c.w4].map((n) => (c.people > 0 ? Math.round((n / c.people) * 100) : 0)),
      })),
      lifecycle: buildFunnel([
        { key: "registered", label: "Специалистов всего", n: l.registered },
        { key: "returned", label: "Зашли больше одного дня", n: l.returned },
        { key: "withClient", label: "Завели клиента", n: l.withClient },
        { key: "withSession", label: "Провели сессию", n: l.withSession },
        { key: "active28", label: "Ведут практику сейчас (28 дней)", n: l.active28 },
      ]),
      sleeping: sleep[0] ?? { psychologists: 0, clients: 0 },
      since: first?.createdAt.toISOString() ?? null,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
