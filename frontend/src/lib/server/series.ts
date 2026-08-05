export type DayCount = { day: string; n: number; sum?: number };

export type SeriesRow = {
  day: string; registrations: number; appointments: number; payments: number; revenue: number;
};

export type SeriesTotals = {
  registrations: number; appointments: number; payments: number; revenue: number;
};

/** Начало окна: `days` суток включая сегодняшние. */
export function windowStart(days: number, now = new Date()): Date {
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return from;
}

/**
 * Сборка ряда по дням из сгруппированных выборок.
 *
 * День без событий обязан присутствовать нулём: пропущенные дни в графике
 * сжимают шкалу и превращают провал в ровную линию — то есть врут ровно там,
 * где на них и смотрят.
 *
 * Выручка живёт в копейках на всём пути: складывать рубли с дробной частью —
 * терять копейку на каждом дне и не сойтись с выпиской.
 */
export function buildSeries(
  from: Date,
  days: number,
  parts: { registrations: DayCount[]; appointments: DayCount[]; payments: DayCount[] },
): { rows: SeriesRow[]; totals: SeriesTotals } {
  const reg = new Map(parts.registrations.map((r) => [r.day, r]));
  const app = new Map(parts.appointments.map((r) => [r.day, r]));
  const pay = new Map(parts.payments.map((r) => [r.day, r]));

  const rows = Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + i);
    const day = d.toISOString().slice(0, 10);
    return {
      day,
      registrations: reg.get(day)?.n ?? 0,
      appointments: app.get(day)?.n ?? 0,
      payments: pay.get(day)?.n ?? 0,
      revenue: pay.get(day)?.sum ?? 0,
    };
  });

  return {
    rows,
    totals: {
      registrations: rows.reduce((s, r) => s + r.registrations, 0),
      appointments: rows.reduce((s, r) => s + r.appointments, 0),
      payments: rows.reduce((s, r) => s + r.payments, 0),
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
    },
  };
}
