import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { buildFunnel } from "@/lib/server/funnel";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

type PsyCounts = { registered: number; profile: number; submitted: number; approved: number; booked: number };
type ClientCounts = { registered: number; booked: number; attended: number; returned: number };

/**
 * Воронки за всё время: где именно люди отваливаются по дороге.
 *
 * База обеих воронок — те, кто пришёл сам. Клиента, которого психолог завёл
 * по приглашению, нельзя считать в знаменателе: он не выбирал платформу, и
 * его появление говорит про психолога, а не про воронку.
 *
 * Шаги «зашёл в каталог» и «открыл карточку» здесь не считаются: просмотры
 * страниц нигде не пишутся. Придумывать их из записей — рисовать 100 %
 * конверсию каталога и врать себе; пусть лучше воронка начинается там, где
 * есть данные.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [psy, client] = await Promise.all([
      prisma.$queryRaw<PsyCounts[]>`
        WITH base AS (
          SELECT u.id FROM "User" u
          WHERE u."deletedAt" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "Client" c WHERE c."userId" = u.id AND c."invitedAt" IS NOT NULL
            )
        )
        SELECT
          count(*)::int AS registered,
          count(p."userId")::int AS profile,
          count(p."submittedAt")::int AS submitted,
          (count(*) FILTER (WHERE p.status = 'approved'))::int AS approved,
          (count(*) FILTER (
            WHERE p.status = 'approved'
              AND EXISTS (SELECT 1 FROM "Appointment" a WHERE a."psychologistId" = b.id)
          ))::int AS booked
        FROM base b LEFT JOIN "PsyProfile" p ON p."userId" = b.id`,
      prisma.$queryRaw<ClientCounts[]>`
        WITH base AS (
          SELECT u.id FROM "User" u
          WHERE u."deletedAt" IS NULL
            AND u.role <> 'psychologist'
            AND NOT EXISTS (SELECT 1 FROM "PsyProfile" p WHERE p."userId" = u.id)
            AND NOT EXISTS (
              SELECT 1 FROM "Client" c WHERE c."userId" = u.id AND c."invitedAt" IS NOT NULL
            )
        ),
        appts AS (
          SELECT c."userId" AS uid,
                 count(*) FILTER (WHERE a.status <> 'cancelled') AS booked,
                 count(*) FILTER (WHERE a.status = 'done') AS done
          FROM "Client" c JOIN "Appointment" a ON a."clientId" = c.id
          WHERE c."userId" IS NOT NULL
          GROUP BY c."userId"
        )
        SELECT
          count(*)::int AS registered,
          (count(*) FILTER (WHERE t.booked > 0))::int AS booked,
          (count(*) FILTER (WHERE t.done > 0))::int AS attended,
          (count(*) FILTER (WHERE t.done > 1))::int AS returned
        FROM base b LEFT JOIN appts t ON t.uid = b.id`,
    ]);

    const p = psy[0] ?? { registered: 0, profile: 0, submitted: 0, approved: 0, booked: 0 };
    const c = client[0] ?? { registered: 0, booked: 0, attended: 0, returned: 0 };

    return NextResponse.json({
      psychologist: buildFunnel([
        { key: "registered", label: "Регистрации", n: p.registered },
        { key: "profile", label: "Завели анкету", n: p.profile },
        { key: "submitted", label: "Подали на проверку", n: p.submitted },
        { key: "approved", label: "Одобрены — в каталоге", n: p.approved },
        { key: "booked", label: "Первая запись", n: p.booked },
      ]),
      client: buildFunnel([
        { key: "registered", label: "Аккаунты клиентов", n: c.registered },
        { key: "booked", label: "Записались", n: c.booked },
        { key: "attended", label: "Сессия состоялась", n: c.attended },
        { key: "returned", label: "Пришли второй раз", n: c.returned },
      ]),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
