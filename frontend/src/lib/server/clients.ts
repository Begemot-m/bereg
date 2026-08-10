// Карточка клиента в том виде, в каком её ждёт интерфейс: строка из базы плюс
// шесть чисел рядом с именем — сколько встреч прошло, когда следующая, как идут
// задания. Раньше их считало только демо, а боевой роут отдавал сырую строку:
// в проде у каждого клиента было «0 сессий», а статус вычислялся как «Пауза».
//
// Считаем группировками, а не выборкой записей: у практикующего психолога их за
// год тысячи, и тянуть всё в память ради шести чисел незачем.

import { prisma } from "@/lib/server/prisma";

export type ClientStats = {
  sessionsDone: number;
  hoursDone: number;
  nextAt: string | null;
  lastAt: string | null;
  hwTotal: number;
  hwDone: number;
};

const EMPTY: ClientStats = { sessionsDone: 0, hoursDone: 0, nextAt: null, lastAt: null, hwTotal: 0, hwDone: 0 };

export async function statsFor(clientIds: number[]): Promise<Map<number, ClientStats>> {
  const out = new Map<number, ClientStats>();
  if (clientIds.length === 0) return out;

  const where = { clientId: { in: clientIds } };
  const [done, upcoming, hwTotal, hwDone] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { ...where, status: "done" },
      _count: { _all: true },
      _sum: { durationMin: true },
      _max: { startsAt: true },
    }),
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { ...where, status: "scheduled", startsAt: { gt: new Date() } },
      _min: { startsAt: true },
    }),
    prisma.homework.groupBy({ by: ["clientId"], where, _count: { _all: true } }),
    prisma.homework.groupBy({ by: ["clientId"], where: { ...where, status: "done" }, _count: { _all: true } }),
  ]);

  for (const id of clientIds) out.set(id, { ...EMPTY });
  for (const row of done) {
    const stats = out.get(row.clientId);
    if (!stats) continue;
    stats.sessionsDone = row._count._all;
    stats.hoursDone = Math.round(((row._sum.durationMin ?? 0) / 60) * 10) / 10;
    stats.lastAt = row._max.startsAt?.toISOString() ?? null;
  }
  for (const row of upcoming) {
    const stats = out.get(row.clientId);
    if (stats) stats.nextAt = row._min.startsAt?.toISOString() ?? null;
  }
  for (const row of hwTotal) {
    const stats = out.get(row.clientId);
    if (stats) stats.hwTotal = row._count._all;
  }
  for (const row of hwDone) {
    const stats = out.get(row.clientId);
    if (stats) stats.hwDone = row._count._all;
  }
  return out;
}

type Row = { id: number };

/** Строки карточек + их статистика. Порядок сохраняется. */
export async function withStats<T extends Row>(rows: T[]): Promise<(T & ClientStats)[]> {
  const stats = await statsFor(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, ...(stats.get(row.id) ?? EMPTY) }));
}

/** То же для одной карточки. */
export async function withStatsOne<T extends Row>(row: T): Promise<T & ClientStats> {
  return (await withStats([row]))[0];
}
