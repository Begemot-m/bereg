import { describe, expect, test } from "bun:test";

import { type PsyRow, pickNudges, weekKey } from "./nudges";

const TZ = "Europe/Moscow";

// Воскресенье 16 августа 2026, 19:30 МСК и будний день 17 августа, 12:00 МСК.
const SUNDAY_EVENING = new Date("2026-08-16T16:30:00Z");
const MONDAY_NOON = new Date("2026-08-17T09:00:00Z");
const MONDAY_NIGHT = new Date("2026-08-17T00:30:00Z");

const row = (over: Partial<PsyRow> = {}): PsyRow => ({
  userId: 1,
  telegramId: 100n,
  held: 0,
  heldClients: 0,
  minutes: 0,
  ahead: 0,
  clients: 3,
  clientsIdle: 0,
  lastVisit: new Date("2026-08-17T08:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

describe("догоняющие сообщения", () => {
  test("итог недели уходит вечером воскресенья тому, у кого была работа", () => {
    const out = pickNudges([row({ held: 6, heldClients: 4, minutes: 330, ahead: 4 })], SUNDAY_EVENING, TZ);

    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("weekly");
    expect(out[0].text).toContain("6 встреч");
    expect(out[0].text).toContain("4 клиента");
    expect(out[0].text).toContain("5,5 часов");
    expect(out[0].text).toContain("записано: 4");
  });

  test("пустую неделю без записей впереди не подсвечиваем вовсе", () => {
    expect(pickNudges([row()], SUNDAY_EVENING, TZ)).toHaveLength(0);
  });

  test("в будни итога недели нет", () => {
    expect(pickNudges([row({ held: 6, ahead: 2 })], MONDAY_NOON, TZ).some((n) => n.kind === "weekly")).toBe(false);
  });

  test("клиентов без записи напоминаем только тому, кто перестал заходить", () => {
    const active = row({ clientsIdle: 2, lastVisit: new Date("2026-08-16T08:00:00Z") });
    const gone = row({ clientsIdle: 2, lastVisit: new Date("2026-08-05T08:00:00Z") });

    expect(pickNudges([active], MONDAY_NOON, TZ)).toHaveLength(0);
    expect(pickNudges([gone], MONDAY_NOON, TZ)[0].kind).toBe("idle_clients");
  });

  test("первого клиента зовём заводить со второго дня и не дольше месяца", () => {
    const fresh = row({ clients: 0, createdAt: new Date("2026-08-16T09:00:00Z"), lastVisit: null });
    const ready = row({ clients: 0, createdAt: new Date("2026-08-14T09:00:00Z"), lastVisit: null });
    const old = row({ clients: 0, createdAt: new Date("2026-05-01T09:00:00Z"), lastVisit: null });

    expect(pickNudges([fresh], MONDAY_NOON, TZ)).toHaveLength(0);
    expect(pickNudges([ready], MONDAY_NOON, TZ)[0].kind).toBe("no_client");
    expect(pickNudges([old], MONDAY_NOON, TZ)).toHaveLength(0);
  });

  test("тому, кто в приложении бывает, про первого клиента не пишем", () => {
    const here = row({ clients: 0, createdAt: new Date("2026-08-14T09:00:00Z"), lastVisit: new Date("2026-08-16T09:00:00Z") });
    expect(pickNudges([here], MONDAY_NOON, TZ)).toHaveLength(0);
  });

  test("зов за первым клиентом уходит один раз, а не каждую неделю", () => {
    const gone = row({ clients: 0, createdAt: new Date("2026-08-14T09:00:00Z"), lastVisit: null });
    expect(pickNudges([gone], MONDAY_NOON, TZ)[0].periodKey).toBe("once");
  });

  test("ночью не пишем", () => {
    const gone = row({ clientsIdle: 2, lastVisit: new Date("2026-08-05T08:00:00Z") });
    expect(pickNudges([gone], MONDAY_NIGHT, TZ)).toHaveLength(0);
  });

  test("на человека не больше одного сообщения за раз", () => {
    const busy = row({ held: 3, heldClients: 2, minutes: 180, ahead: 1, clients: 0, clientsIdle: 2, lastVisit: new Date("2026-07-01T08:00:00Z") });
    expect(pickNudges([busy], SUNDAY_EVENING, TZ)).toHaveLength(1);
  });

  test("ключ недели один и тот же у всех дней недели", () => {
    expect(weekKey("2026-08-10")).toBe(weekKey("2026-08-16"));
    expect(weekKey("2026-08-17")).not.toBe(weekKey("2026-08-16"));
  });
});
