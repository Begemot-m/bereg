import { describe, expect, test } from "bun:test";

import { buildFunnel } from "./funnel";

const steps = (...ns: number[]) => ns.map((n, i) => ({ key: `s${i}`, label: `шаг ${i}`, n }));

describe("воронка", () => {
  test("доли считаются от начала и от предыдущего шага", () => {
    const rows = buildFunnel(steps(100, 50, 25, 5));

    expect(rows.map((r) => r.ofFirst)).toEqual([100, 50, 25, 5]);
    expect(rows.map((r) => r.ofPrev)).toEqual([100, 50, 50, 20]);
  });

  test("пустая база даёт нули, а не NaN", () => {
    const rows = buildFunnel(steps(0, 0, 0));
    expect(rows.every((r) => r.ofFirst === 0 && r.ofPrev === 0)).toBe(true);
  });

  test("обрыв в середине не ломает следующие шаги", () => {
    const rows = buildFunnel(steps(10, 0, 0));
    expect(rows[1]).toMatchObject({ ofFirst: 0, ofPrev: 0 });
    expect(rows[2]).toMatchObject({ ofFirst: 0, ofPrev: 0 });
  });

  test("рост на шаге виден как больше ста процентов, а не прячется", () => {
    const rows = buildFunnel(steps(10, 12));
    expect(rows[1].ofPrev).toBe(120);
  });
});
