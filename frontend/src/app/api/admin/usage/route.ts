import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

type Totals = { visitors: number; psychologists: number; clients: number; guests: number; visits: number };
type SectionRow = { section: string; visits: number; people: number };

/** Сутки режем по Москве: иначе «сегодня» начинается в три часа ночи. */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

function startOfMskDay(now = new Date()): Date {
  const msk = new Date(now.getTime() + MSK_OFFSET_MS);
  msk.setUTCHours(0, 0, 0, 0);
  return new Date(msk.getTime() - MSK_OFFSET_MS);
}

const daysAgo = (days: number, now = new Date()) => new Date(now.getTime() - days * 86_400_000);

/**
 * Посещаемость: сколько людей заходило и в какие разделы. Сессия живёт
 * неделями, аудит пишется только на важные действия — ни то, ни другое на этот
 * вопрос не отвечает, поэтому считаем по таблице заходов.
 *
 * Уникальных людей считаем по устройству: гость каталога не авторизован, но он
 * такой же посетитель, как вошедший.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = new Date();
    const windows: { key: "day" | "week" | "month" | "all"; from: Date }[] = [
      { key: "day", from: startOfMskDay(now) },
      { key: "week", from: daysAgo(7, now) },
      { key: "month", from: daysAgo(30, now) },
      { key: "all", from: new Date(0) },
    ];

    const [totals, sections, first] = await Promise.all([
      Promise.all(windows.map(({ from }) => prisma.$queryRaw<Totals[]>`
        SELECT count(DISTINCT "device")::int AS visitors,
               count(DISTINCT "userId") FILTER (WHERE "role" = 'psychologist')::int AS psychologists,
               count(DISTINCT "userId") FILTER (WHERE "role" = 'client')::int AS clients,
               count(DISTINCT "device") FILTER (WHERE "userId" IS NULL)::int AS guests,
               count(*)::int AS visits
        FROM "Visit" WHERE "createdAt" >= ${from}`)),
      Promise.all(windows.map(({ from }) => prisma.$queryRaw<SectionRow[]>`
        SELECT "section",
               count(*)::int AS visits,
               count(DISTINCT "device")::int AS people
        FROM "Visit" WHERE "createdAt" >= ${from}
        GROUP BY 1 ORDER BY 2 DESC`)),
      prisma.visit.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]);

    const empty: Totals = { visitors: 0, psychologists: 0, clients: 0, guests: 0, visits: 0 };
    const periods = Object.fromEntries(windows.map(({ key }, i) => [
      key,
      { ...(totals[i][0] ?? empty), sections: sections[i] },
    ]));

    return NextResponse.json({
      periods,
      // Раньше этой даты заходы не писались вовсе — это не «никто не заходил».
      since: first?.createdAt?.toISOString() ?? null,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
