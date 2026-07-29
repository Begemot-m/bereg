import { describe, expect, test } from "bun:test";

import { canCancel } from "./cancel-policy";

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe("запрет отмены сессии", () => {
  test("без запрета отменить можно всегда", () => {
    expect(canCancel(inDays(0.1), 0)).toBe(true);
    expect(canCancel(inDays(10), 0)).toBe(true);
  });

  test("за сутки при запрете в два дня — уже нельзя", () => {
    expect(canCancel(inDays(1), 2)).toBe(false);
  });

  test("за три дня при запрете в два — можно", () => {
    expect(canCancel(inDays(3), 2)).toBe(true);
  });

  test("прошедшую сессию отменить нельзя", () => {
    expect(canCancel(inDays(-1), 1)).toBe(false);
  });
});
