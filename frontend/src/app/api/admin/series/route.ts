import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { buildSeries, windowStart, type DayCount } from "@/lib/server/series";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

const ZONE = "Europe/Moscow";

/**
 * Ряды по дням: регистрации, записи, оплаты. Итог за всё время говорит, что
 * платформа жива, но не говорит, растёт она или встала, — а это и есть
 * единственный вопрос к цифрам на старте.
 *
 * Сутки режем по Москве, а не по UTC: иначе «сегодня» в сводке начинается
 * в три часа ночи и вечерние регистрации уезжают в завтра.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const days = url.searchParams.get("days") === "90" ? 90 : 30;

    const from = windowStart(days);

    const [registrations, appointments, payments, firstPayment] = await Promise.all([
      prisma.$queryRaw<DayCount[]>`
        SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${ZONE}), 'YYYY-MM-DD') AS day,
               count(*)::int AS n
        FROM "User" WHERE "createdAt" >= ${from} GROUP BY 1`,
      prisma.$queryRaw<DayCount[]>`
        SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE ${ZONE}), 'YYYY-MM-DD') AS day,
               count(*)::int AS n
        FROM "Appointment" WHERE "createdAt" >= ${from} AND "status" <> 'cancelled' GROUP BY 1`,
      prisma.$queryRaw<DayCount[]>`
        SELECT to_char(date_trunc('day', "paidAt" AT TIME ZONE ${ZONE}), 'YYYY-MM-DD') AS day,
               count(*)::int AS n, coalesce(sum("amount"), 0)::int AS sum
        FROM "Payment" WHERE "paidAt" >= ${from} GROUP BY 1`,
      prisma.payment.findFirst({ orderBy: { paidAt: "asc" }, select: { paidAt: true } }),
    ]);

    const { rows, totals } = buildSeries(from, days, { registrations, appointments, payments });

    return NextResponse.json({
      days,
      from: from.toISOString(),
      rows,
      totals,
      // До этой даты платежи нигде не сохранялись: подписка держала только
      // последний. Без отметки ряд оплат читается как «продаж не было».
      paymentsSince: firstPayment?.paidAt.toISOString() ?? null,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
