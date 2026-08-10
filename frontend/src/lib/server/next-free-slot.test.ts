import { describe, expect, it } from "bun:test";

import { nextFreeSlotDays, type WorkHoursDTO } from "./schedule";

// Каталог обещает «ближайшее окно через N дней». Пока это считалось по одному
// шаблону недели, снятая дата и занятое окно в расчёт не входили — карточка
// звала записаться раньше, чем календарь показывал свободное время.

const work = (hours: WorkHoursDTO["hours"]): WorkHoursDTO => ({
  hours,
  sessionMinutes: 50,
  cancelLockDays: 0,
  leadDaysOffline: 0,
  leadDaysOnline: 0,
  dayFrom: 9,
  dayTo: 21,
});

/** Окно на каждый день недели в указанный час. */
const everyDayAt = (time: string) =>
  Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ t: time, d: 50, fmt: "online" as const }]]));

const dayAhead = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
};

/** ISO окна из шаблона на день через `days` дней. */
const slotIso = (days: number) => {
  const d = dayAhead(days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
};

// Шаблон на позднее время: окно сегодняшнего дня ещё не прошло, поэтому
// «ближайшее» упирается именно в снятые и занятые окна, а не в часы прогона.
const LATE = everyDayAt("23:59");

describe("nextFreeSlotDays", () => {
  it("без графика окна нет", () => {
    expect(nextFreeSlotDays(work({}), [], {})).toBe(14);
  });

  it("открытое окно есть — ближайший день", () => {
    expect(nextFreeSlotDays(work(LATE), [], {})).toBe(1);
  });

  it("снятые даты не считаются свободными", () => {
    const overrides = { [slotIso(0)]: { removed: true }, [slotIso(1)]: { removed: true } };
    expect(nextFreeSlotDays(work(LATE), [], overrides)).toBe(2);
  });

  it("занятые окна не считаются свободными", () => {
    const busy = [{ start: slotIso(0), minutes: 50 }, { start: slotIso(1), minutes: 50 }];
    expect(nextFreeSlotDays(work(LATE), busy, {})).toBe(2);
  });

  it("правило предварительной записи отодвигает ближайшее окно", () => {
    expect(nextFreeSlotDays({ ...work(LATE), leadDaysOnline: 3 }, [], {})).toBe(3);
  });
});
