import { describe, expect, it } from "bun:test";

import { lockedByPolicy } from "./schedule";

const NOW = new Date("2026-08-07T12:00:00.000Z").getTime();
const inDays = (days: number) => new Date(NOW + days * 86_400_000);

describe("lockedByPolicy", () => {
  it("без правила отмена разрешена всегда", () => {
    expect(lockedByPolicy(inDays(0.01), 0, NOW)).toBe(false);
    expect(lockedByPolicy(inDays(-3), 0, NOW)).toBe(false);
  });

  it("ближе порога — заперто", () => {
    expect(lockedByPolicy(inDays(1), 2, NOW)).toBe(true);
    expect(lockedByPolicy(inDays(1.99), 2, NOW)).toBe(true);
  });

  it("дальше порога — открыто", () => {
    expect(lockedByPolicy(inDays(2), 2, NOW)).toBe(false);
    expect(lockedByPolicy(inDays(3), 2, NOW)).toBe(false);
  });

  it("прошедшую встречу клиент не трогает", () => {
    expect(lockedByPolicy(inDays(-1), 1, NOW)).toBe(true);
  });
});
