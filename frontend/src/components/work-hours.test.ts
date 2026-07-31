import { describe, expect, test } from "bun:test";

import { snapMin } from "./work-hours";

// Окна в графике липнут к каждой четверти часа.
describe("прилипание окна к якорям часа", () => {
  const h = (hour: number, min = 0) => hour * 60 + min;

  test("ровный час остаётся ровным", () => {
    expect(snapMin(h(10))).toBe(h(10));
    expect(snapMin(h(10, 15))).toBe(h(10, 15));
  });

  test("тянется к ближайшему якорю", () => {
    expect(snapMin(h(10, 5))).toBe(h(10, 0));
    expect(snapMin(h(10, 20))).toBe(h(10, 15));
    expect(snapMin(h(10, 24))).toBe(h(10, 30));
    expect(snapMin(h(10, 40))).toBe(h(10, 45));
    expect(snapMin(h(10, 44))).toBe(h(10, 45));
  });

  test("в :45 попасть можно — ради этого всё и делалось", () => {
    expect(snapMin(h(14, 43))).toBe(h(14, 45));
    expect(snapMin(h(14, 47))).toBe(h(14, 45));
  });

  test("после :52 уходит на начало следующего часа", () => {
    expect(snapMin(h(10, 55))).toBe(h(11, 0));
    expect(snapMin(h(10, 59))).toBe(h(11, 0));
  });

  test("промежуточных значений не бывает", () => {
    const allowed = new Set([0, 15, 30, 45]);
    for (let m = 0; m < 24 * 60; m += 1) {
      expect(allowed.has(snapMin(m) % 60)).toBe(true);
    }
  });
});
