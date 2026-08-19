import { describe, expect, test } from "bun:test";

import { pinDay, pinManualDays, sameHours, templateSlots, type PinHours } from "@/lib/schedule-pin";
import { zoneAt } from "@/lib/zone";

// Дата далеко в будущем: тест не должен зависеть от того, когда его запустили.
const DAY = "2099-06-15"; // понедельник
const at = (hhmm: string) => {
  const [hh, mm] = hhmm.split(":").map(Number);
  return zoneAt(DAY, hh, mm)!.toISOString();
};

const week = (slots: { t: string; d: number; fmt: "online" | "offline" }[]): PinHours => ({
  hours: { 0: slots },
  sessionMinutes: 50,
});

describe("шаблон недели против ручных правок", () => {
  test("порядок дней и окон на сравнение не влияет", () => {
    expect(sameHours({ 0: [{ t: "10:00", d: 50, fmt: "online" }], 1: [] }, { 1: [], 0: [{ t: "10:00", d: 50, fmt: "online" }] })).toBe(true);
    expect(sameHours({ 0: [{ t: "10:00", d: 50, fmt: "online" }] }, { 0: [{ t: "11:00", d: 50, fmt: "online" }] })).toBe(false);
  });

  test("окна шаблона на дату считаются по дню недели", () => {
    const slots = templateSlots(week([{ t: "10:00", d: 50, fmt: "online" }]), DAY, 0);
    expect(slots).toEqual([{ iso: at("10:00"), fmt: "online", dur: 50 }]);
  });

  test("день с удалённым окном не перестраивается под новый шаблон", () => {
    const before = week([{ t: "10:00", d: 50, fmt: "online" }, { t: "12:00", d: 50, fmt: "online" }]);
    const after = week([{ t: "15:00", d: 50, fmt: "online" }]);
    const overrides = { [at("12:00")]: { removed: true } };
    const writes = pinManualDays(before, after, overrides, 0);

    // Оставшееся окно становится разовым — от шаблона оно больше не зависит.
    expect(writes).toContainEqual({ iso: at("10:00"), removed: false, fmt: "online", added: true, dur: 50 });
    // Новое окно шаблона на эту дату закрыто: день трогать не просили.
    expect(writes).toContainEqual({ iso: at("15:00"), removed: true, fmt: null, added: false, dur: null });
    // Уже снятое окно переписывать незачем.
    expect(writes.some((w) => w.iso === at("12:00"))).toBe(false);
  });

  test("шаблон не поменялся — писать нечего", () => {
    const hours = week([{ t: "10:00", d: 50, fmt: "online" }]);
    expect(pinManualDays(hours, { ...hours }, { [at("10:00")]: { removed: true } }, 0)).toEqual([]);
  });

  test("даты без ручных правок остаются на шаблоне", () => {
    const before = week([{ t: "10:00", d: 50, fmt: "online" }]);
    const after = week([{ t: "15:00", d: 50, fmt: "online" }]);
    expect(pinManualDays(before, after, {}, 0)).toEqual([]);
  });

  test("разовое окно и смена формата переживают смену шаблона", () => {
    const before = templateSlots(week([{ t: "10:00", d: 50, fmt: "online" }]), DAY, 0);
    const after = templateSlots(week([{ t: "18:00", d: 50, fmt: "online" }]), DAY, 0);
    const overrides = {
      [at("10:00")]: { fmt: "offline" as const },
      [at("20:00")]: { added: true, dur: 90 },
    };
    const writes = pinDay(before, after, overrides);
    // Очный формат уезжает в разовое окно вместе со временем.
    expect(writes).toContainEqual({ iso: at("10:00"), removed: false, fmt: "offline", added: true, dur: 50 });
    // Разовое окно уже разовое — переписывать его не нужно.
    expect(writes.some((w) => w.iso === at("20:00"))).toBe(false);
    expect(writes).toContainEqual({ iso: at("18:00"), removed: true, fmt: null, added: false, dur: null });
  });

  test("прошедшие правки день не прибивают", () => {
    const before = week([{ t: "10:00", d: 50, fmt: "online" }]);
    const after = week([{ t: "15:00", d: 50, fmt: "online" }]);
    const later = new Date(at("23:00")).getTime();
    expect(pinManualDays(before, after, { [at("10:00")]: { removed: true } }, later)).toEqual([]);
  });
});
