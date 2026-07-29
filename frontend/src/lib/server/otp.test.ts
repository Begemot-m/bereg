import { describe, expect, test } from "bun:test";

import { generateCode, looksLikeEmail, normalizeEmail } from "./otp";

describe("одноразовый код", () => {
  test("всегда шесть цифр, включая ведущие нули", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  test("коды не повторяются подряд", () => {
    // Грубая проверка на «генератор залип»: 50 подряд одинаковых
    // шестизначных значений — событие, которого не бывает.
    const codes = new Set(Array.from({ length: 50 }, generateCode));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("почта", () => {
  test("приводится к нижнему регистру и без пробелов", () => {
    expect(normalizeEmail("  Ivan.Petrov@Example.RU ")).toBe("ivan.petrov@example.ru");
  });

  test("отсекает мусор", () => {
    expect(looksLikeEmail("me@example.ru")).toBe(true);
    expect(looksLikeEmail("me@example.co.uk")).toBe(true);
    expect(looksLikeEmail("не почта")).toBe(false);
    expect(looksLikeEmail("me@example")).toBe(false);
    expect(looksLikeEmail("@example.ru")).toBe(false);
    expect(looksLikeEmail("me@@example.ru")).toBe(false);
    expect(looksLikeEmail("")).toBe(false);
  });
});
