import { describe, expect, it } from "bun:test";

import { inviteMessage, TEXT_DAYS, type FreeDay } from "@/lib/invite-windows";

const day = (n: number): FreeDay => ({ ymd: `2026-09-0${n}`, label: `День ${n}`, times: ["10:00", "12:00"] });

describe("inviteMessage", () => {
  it("в тексте не больше трёх дней, даже если окна есть на всю неделю", () => {
    const text = inviteMessage("Анна", [1, 2, 3, 4, 5, 6, 7].map(day), "week");
    const lines = text.split("\n").filter((l) => l.startsWith("•"));
    expect(lines).toHaveLength(TEXT_DAYS);
    expect(lines[0]).toContain("День 1");
    expect(text).not.toContain("День 4");
  });

  it("дней меньше трёх — берём сколько есть", () => {
    const lines = inviteMessage("Анна", [day(1), day(2)], "week").split("\n").filter((l) => l.startsWith("•"));
    expect(lines).toHaveLength(2);
  });

  it("окон нет — вместо списка приглашение на страницу", () => {
    const text = inviteMessage("Анна", [], "week");
    expect(text).not.toContain("•");
    expect(text).toContain("расписании");
  });
});
