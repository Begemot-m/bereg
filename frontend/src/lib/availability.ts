import type { TimeOfDay } from "@/lib/catalog";

export type DayGroup = "weekdays" | "weekends";
/** Минимум, который нужен от расписания: время окна по дням недели. */
export type ScheduleHours = { hours?: Record<number, { t: string }[]> | null };

/** Слепок расписания специалиста: какие дни и какое время у него открыты. */
export type Availability = { days: DayGroup[]; times: TimeOfDay[]; slots: number };

export const EMPTY_AVAILABILITY: Availability = { days: [], times: [], slots: 0 };

export function timeOfDay(time: string): TimeOfDay {
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return "morning";
  if (hour < 17) return "day";
  return "evening";
}

const DAY_ORDER: DayGroup[] = ["weekdays", "weekends"];
const TIME_ORDER: TimeOfDay[] = ["morning", "day", "evening"];

/**
 * Рабочие часы → доступность для подборки. Ключ `hours` — день недели с
 * понедельника (0…6), как в расписании: 5 и 6 это выходные.
 *
 * Отсюда фильтр «когда удобно» и берёт правду: заполнил специалист график —
 * его окна сразу участвуют в подборе, без отдельной ручной отметки.
 */
export function availabilityFromWorkHours(work: ScheduleHours | null | undefined): Availability {
  const hours = work?.hours ?? {};
  const days = new Set<DayGroup>();
  const times = new Set<TimeOfDay>();
  let slots = 0;
  for (const [key, list] of Object.entries(hours)) {
    if (!list?.length) continue;
    const day = Number(key);
    if (!Number.isFinite(day)) continue;
    days.add(day >= 5 ? "weekends" : "weekdays");
    slots += list.length;
    for (const slot of list) times.add(timeOfDay(slot.t));
  }
  return {
    days: DAY_ORDER.filter((day) => days.has(day)),
    times: TIME_ORDER.filter((time) => times.has(time)),
    slots,
  };
}

const hit = <T>(a: T[], b: T[]) => a.filter((item) => b.includes(item)).length;

/** Сколько пожеланий клиента по времени реально закрыты графиком. */
export function availabilityScore(availability: Availability, days: DayGroup[], times: TimeOfDay[]): number {
  return hit(availability.days, days) + hit(availability.times, times);
}

/**
 * Подходит ли график под пожелания. Пустой график не отсекаем: специалист мог
 * ещё не заполнить расписание, а окна назначить руками.
 */
export function availabilityFits(availability: Availability, days: DayGroup[], times: TimeOfDay[]): boolean {
  if (days.length && availability.days.length && !hit(availability.days, days)) return false;
  if (times.length && availability.times.length && !hit(availability.times, times)) return false;
  return true;
}

const TIME_LABEL: Record<TimeOfDay, string> = { morning: "утром", day: "днём", evening: "вечером" };

export function availabilityLabel(availability: Availability): string {
  if (!availability.slots) return "график пока не заполнен";
  const days = availability.days.length === 2 ? "будни и выходные" : availability.days[0] === "weekends" ? "выходные" : "будни";
  const times = availability.times.map((time) => TIME_LABEL[time]).join(", ");
  return times ? `${days} · ${times}` : days;
}
