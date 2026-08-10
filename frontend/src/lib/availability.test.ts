import { describe, expect, test } from "bun:test";

import { availabilityFits, availabilityFromWorkHours, availabilityScore, nextSlotDays, timeOfDay } from "@/lib/availability";

const slot = (t: string) => ({ t, d: 50, fmt: "online" as const });

describe("availabilityFromWorkHours", () => {
  test("пустой график — пустая доступность", () => {
    expect(availabilityFromWorkHours(null)).toEqual({ days: [], times: [], slots: 0 });
    expect(availabilityFromWorkHours({ hours: {} })).toEqual({ days: [], times: [], slots: 0 });
  });

  test("дни недели с понедельника: 5 и 6 — выходные", () => {
    expect(availabilityFromWorkHours({ hours: { 0: [slot("11:00")] } }).days).toEqual(["weekdays"]);
    expect(availabilityFromWorkHours({ hours: { 6: [slot("11:00")] } }).days).toEqual(["weekends"]);
    expect(availabilityFromWorkHours({ hours: { 3: [slot("11:00")], 5: [slot("12:00")] } }).days).toEqual(["weekdays", "weekends"]);
  });

  test("время окна попадает в утро/день/вечер и не дублируется", () => {
    const availability = availabilityFromWorkHours({ hours: { 0: [slot("09:30"), slot("11:00"), slot("13:00")], 2: [slot("19:00")] } });
    expect(availability.times).toEqual(["morning", "day", "evening"]);
    expect(availability.slots).toBe(4);
  });

  test("пустой список окон день не открывает", () => {
    expect(availabilityFromWorkHours({ hours: { 0: [], 5: [slot("10:00")] } })).toEqual({ days: ["weekends"], times: ["morning"], slots: 1 });
  });

  test("границы суток", () => {
    expect(timeOfDay("00:00")).toBe("morning");
    expect(timeOfDay("11:59")).toBe("morning");
    expect(timeOfDay("12:00")).toBe("day");
    expect(timeOfDay("16:45")).toBe("day");
    expect(timeOfDay("17:00")).toBe("evening");
  });
});

describe("availabilityFits", () => {
  const evenings = availabilityFromWorkHours({ hours: { 1: [slot("19:00")] } });

  test("пожелание без пересечения с графиком отсекается", () => {
    expect(availabilityFits(evenings, [], ["morning"])).toBe(false);
    expect(availabilityFits(evenings, ["weekends"], [])).toBe(false);
  });

  test("совпадение хотя бы по одному пункту проходит", () => {
    expect(availabilityFits(evenings, ["weekdays"], ["morning", "evening"])).toBe(true);
    expect(availabilityFits(evenings, [], [])).toBe(true);
  });

  test("незаполненный график не отсекаем — окна могут назначаться руками", () => {
    expect(availabilityFits({ days: [], times: [], slots: 0 }, ["weekends"], ["morning"])).toBe(true);
  });

  test("счёт растёт с числом совпадений", () => {
    expect(availabilityScore(evenings, ["weekdays"], ["evening"])).toBe(2);
    expect(availabilityScore(evenings, ["weekends"], ["evening"])).toBe(1);
  });
});

describe("ближайшее окно", () => {
  // Понедельник, 10 августа 2026.
  const monday = new Date("2026-08-10T09:00:00+03:00");

  test("пустой график — через две недели", () => {
    expect(nextSlotDays(null, monday)).toBe(14);
    expect(nextSlotDays({ hours: {} }, monday)).toBe(14);
  });

  test("окно сегодня считается завтрашним, а не нулевым днём", () => {
    expect(nextSlotDays({ hours: { 0: [{ t: "11:00" }] } }, monday)).toBe(1);
  });

  test("ближайший день недели с окнами", () => {
    expect(nextSlotDays({ hours: { 3: [{ t: "10:00" }] } }, monday)).toBe(3);
    expect(nextSlotDays({ hours: { 6: [{ t: "10:00" }], 2: [{ t: "10:00" }] } }, monday)).toBe(2);
  });
});
