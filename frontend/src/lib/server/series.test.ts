import { describe, expect, test } from "bun:test";

import { buildSeries, windowStart } from "./series";

const empty = { registrations: [], appointments: [], payments: [] };

describe("ряды по дням", () => {
  test("окно включает сегодня и заканчивается сегодня", () => {
    const now = new Date("2026-08-05T21:30:00.000Z");
    const from = windowStart(30, now);
    expect(from.toISOString()).toBe("2026-07-07T00:00:00.000Z");

    const { rows } = buildSeries(from, 30, empty);
    expect(rows).toHaveLength(30);
    expect(rows[0].day).toBe("2026-07-07");
    expect(rows[29].day).toBe("2026-08-05");
  });

  test("дни без событий остаются в ряду нулями", () => {
    const from = new Date("2026-08-01T00:00:00.000Z");
    const { rows } = buildSeries(from, 3, {
      registrations: [{ day: "2026-08-03", n: 2 }],
      appointments: [],
      payments: [],
    });

    expect(rows.map((r) => r.registrations)).toEqual([0, 0, 2]);
    expect(rows.map((r) => r.day)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  test("выручка складывается в копейках и сходится с суммой дней", () => {
    const from = new Date("2026-08-01T00:00:00.000Z");
    const { rows, totals } = buildSeries(from, 3, {
      registrations: [],
      appointments: [],
      payments: [
        { day: "2026-08-01", n: 1, sum: 99000 },
        { day: "2026-08-03", n: 2, sum: 198000 },
      ],
    });

    expect(totals.payments).toBe(3);
    expect(totals.revenue).toBe(297000);
    expect(rows.reduce((s, r) => s + r.revenue, 0)).toBe(totals.revenue);
  });

  test("данные вне окна в ряд не попадают", () => {
    const from = new Date("2026-08-01T00:00:00.000Z");
    const { totals } = buildSeries(from, 2, {
      registrations: [{ day: "2026-07-31", n: 5 }, { day: "2026-08-09", n: 7 }],
      appointments: [],
      payments: [],
    });

    expect(totals.registrations).toBe(0);
  });
});
