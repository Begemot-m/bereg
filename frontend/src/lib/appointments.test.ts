import { describe, expect, test } from "bun:test";

import { awaitsConfirm, hasEnded, isAhead, isRunning, type Appointment } from "@/lib/appointments";

const appt = (patch: Partial<Appointment> = {}): Appointment => ({
  id: 1,
  startsAt: new Date().toISOString(),
  durationMin: 50,
  status: "scheduled",
  note: "",
  format: "online",
  client: { id: 1, name: "Анна" },
  ...patch,
});

describe("awaitsConfirm", () => {
  test("самозапись без ответа специалиста ждёт подтверждения", () => {
    expect(awaitsConfirm(appt({ confirmedAt: null }))).toBe(true);
    expect(awaitsConfirm(appt())).toBe(true);
  });

  test("подтверждённая встреча в очередь не попадает", () => {
    expect(awaitsConfirm(appt({ confirmedAt: new Date().toISOString() }))).toBe(false);
  });

  test("отменённые и состоявшиеся подтверждать нечего", () => {
    expect(awaitsConfirm(appt({ status: "cancelled", confirmedAt: null }))).toBe(false);
    expect(awaitsConfirm(appt({ status: "done", confirmedAt: null }))).toBe(false);
  });
});

describe("сессия во времени", () => {
  const now = +new Date("2026-08-26T12:00:00Z");
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

  test("идущая сессия не считается прошедшей", () => {
    const live = appt({ startsAt: at(-10), durationMin: 50 });
    expect(isRunning(live, now)).toBe(true);
    expect(hasEnded(live, now)).toBe(false);
    expect(isAhead(live, now)).toBe(true);
  });

  test("состоявшейся сессия становится, когда время вышло целиком", () => {
    const done = appt({ startsAt: at(-60), durationMin: 50 });
    expect(hasEnded(done, now)).toBe(true);
    expect(isRunning(done, now)).toBe(false);
    expect(isAhead(done, now)).toBe(false);
  });

  test("минута в минуту конца — уже прошедшая", () => {
    expect(hasEnded(appt({ startsAt: at(-50), durationMin: 50 }), now)).toBe(true);
  });

  test("отменённая в предстоящие не попадает", () => {
    expect(isAhead(appt({ startsAt: at(60), status: "cancelled" }), now)).toBe(false);
    expect(isAhead(appt({ startsAt: at(60) }), now)).toBe(true);
  });
});
