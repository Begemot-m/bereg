import { describe, expect, test } from "bun:test";

import { awaitsConfirm, type Appointment } from "@/lib/appointments";

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
