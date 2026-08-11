// Расписание живёт в часовом поясе платформы, а не в поясе процесса или
// устройства. Сервер считал окна в зоне платформы, а браузер рисовал их в своей:
// психолог из Екатеринбурга выставлял «10:00», а в своей же неделе видел
// «12:00». Поэтому и сервер, и клиент берут зону отсюда.
//
// На клиенте `APP_TIME_ZONE` недоступна (её нет в бандле) — переопределить
// можно только `NEXT_PUBLIC_APP_TIME_ZONE` на сборке. По умолчанию обе дают
// Москву, так что расходиться им негде.

const ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || process.env.APP_TIME_ZONE || "Europe/Moscow";

export const APP_ZONE = ZONE;

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type Wall = { y: number; m: number; d: number; hh: number; mm: number; ss: number };

function wallOf(at: Date): Wall {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(at)) if (part.type !== "literal") p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute, ss: +p.second };
}

/** Сдвиг зоны относительно UTC в конкретный момент — с учётом перевода часов. */
function offsetMs(at: Date): number {
  const w = wallOf(at);
  return Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss) - Math.floor(at.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Момент времени по «настенным» часам зоны: 10:00 в Москве, а не в UTC. */
export function zonedTime(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Два прохода: сдвиг зависит от самого момента, и на переводе часов первая
  // прикидка может попасть не в тот интервал.
  const first = wall - offsetMs(new Date(wall));
  return new Date(wall - offsetMs(new Date(first)));
}

export function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return { y: +y, m: +m, d: +d };
}

/** Полночь календарной даты в зоне платформы. */
export function zonedDayStart(ymd: string): Date | null {
  const parsed = parseYmd(ymd);
  return parsed ? zonedTime(parsed.y, parsed.m, parsed.d) : null;
}

/** Полночь календарной даты в зоне платформы — для дат, которые уже проверены. */
export const zoneDay = (ymd: string): Date => zonedDayStart(ymd) ?? new Date(`${ymd}T00:00:00`);

/** Дата момента в зоне платформы, `YYYY-MM-DD`. */
export function zoneYmd(at: Date = new Date()): string {
  const w = wallOf(at);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`;
}

/** Час момента в зоне платформы — для «утро / день / вечер». */
export const zoneHour = (at: Date): number => wallOf(at).hh;

/** Число месяца в зоне платформы — для подписей вида «Среда, 12». */
export const zoneDayNumber = (at: Date): number => wallOf(at).d;

/** Календарная арифметика без часовых поясов: дата плюс N дней. */
export function addDays(ymd: string, days: number): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return ymd;
  const at = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  at.setUTCDate(at.getUTCDate() + days);
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

/** День недели календарной даты: 0 — понедельник, как в шаблоне графика. */
export function weekdayOf(ymd: string): number {
  const parsed = parseYmd(ymd);
  if (!parsed) return 0;
  return (new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).getUTCDay() + 6) % 7;
}

/** День недели момента в зоне платформы: 0 — понедельник. */
export const zoneWeekday = (at: Date): number => weekdayOf(zoneYmd(at));

/** Один ли это день по календарю платформы. */
export function sameZoneDay(a: Date, b: Date): boolean {
  return zoneYmd(a) === zoneYmd(b);
}

/** Разница в календарных днях платформы: «сегодня / завтра / вчера» без сдвигов. */
export function zoneDayDiff(from: Date, to: Date): number {
  return Math.round((zoneDay(zoneYmd(to)).getTime() - zoneDay(zoneYmd(from)).getTime()) / 86400000);
}

/** Момент по «настенным» часам зоны для календарной даты: `zoneAt("2026-08-12", 10, 0)`. */
export function zoneAt(ymd: string, hh: number, mm = 0): Date | null {
  const parsed = parseYmd(ymd);
  return parsed ? zonedTime(parsed.y, parsed.m, parsed.d, hh, mm) : null;
}

/**
 * Форматтер в зоне платформы. Время встречи должно читаться одинаково у
 * психолога и клиента, где бы ни стояли их устройства.
 */
export const zoneFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: ZONE, ...options });
