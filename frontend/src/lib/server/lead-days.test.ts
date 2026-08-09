import { describe, expect, it } from "bun:test";

import { clampLead, leadBlocked, leadDaysFor } from "./schedule";

const NOW = new Date("2026-08-09T12:00:00.000Z").getTime();
const inDays = (days: number) => new Date(NOW + days * 86_400_000);

describe("leadBlocked", () => {
  it("без правила записывают в любое окно", () => {
    expect(leadBlocked(inDays(0.01), 0, NOW)).toBe(false);
  });

  it("ближе порога — записаться нельзя", () => {
    expect(leadBlocked(inDays(0.5), 1, NOW)).toBe(true);
    expect(leadBlocked(inDays(2.99), 3, NOW)).toBe(true);
  });

  it("ровно на пороге и дальше — можно", () => {
    expect(leadBlocked(inDays(3), 3, NOW)).toBe(false);
    expect(leadBlocked(inDays(10), 3, NOW)).toBe(false);
  });
});

describe("leadDaysFor", () => {
  it("очно и онлайн считаются отдельно", () => {
    const work = { leadDaysOffline: 3, leadDaysOnline: 1 };
    expect(leadDaysFor(work, "offline")).toBe(3);
    expect(leadDaysFor(work, "online")).toBe(1);
  });
});

describe("clampLead", () => {
  it("держит настройку в пределах месяца", () => {
    expect(clampLead(-5)).toBe(0);
    expect(clampLead(2.7)).toBe(2);
    expect(clampLead(99)).toBe(30);
  });
});
