import { describe, expect, test } from "bun:test";

import { hit } from "./rate-limit";

describe("ограничение частоты", () => {
  test("пропускает до предела и режет после", () => {
    const key = `test-${Math.random()}`;
    const mode = { limit: 3, windowMs: 60_000 };

    expect(hit(key, mode).ok).toBe(true);
    expect(hit(key, mode).ok).toBe(true);
    expect(hit(key, mode).ok).toBe(true);

    const blocked = hit(key, mode);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  test("ключи не влияют друг на друга", () => {
    const mode = { limit: 1, windowMs: 60_000 };
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;

    expect(hit(a, mode).ok).toBe(true);
    expect(hit(a, mode).ok).toBe(false);
    // Другой адрес не должен страдать от чужого перебора.
    expect(hit(b, mode).ok).toBe(true);
  });

  test("окно скользит: после истечения счётчик освобождается", async () => {
    const key = `slide-${Math.random()}`;
    const mode = { limit: 2, windowMs: 60 };

    expect(hit(key, mode).ok).toBe(true);
    expect(hit(key, mode).ok).toBe(true);
    expect(hit(key, mode).ok).toBe(false);

    await new Promise((r) => setTimeout(r, 80));
    expect(hit(key, mode).ok).toBe(true);
  });
});
