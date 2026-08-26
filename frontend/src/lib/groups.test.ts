import { describe, expect, test } from "bun:test";

import { groupsOfClient, isFading, isLive, isOver, memberOfClient, memberStats, missStreak, nextMeeting, untilLabel, type Group, type GroupMeeting } from "./groups";

const HOUR = 3_600_000;
const ago = (days: number) => new Date(Date.now() - days * 24 * HOUR).toISOString();

// Отметки: true — был, false — пропустил. Встречи идут от старых к свежим.
function group(rows: (boolean | null)[], ahead = 0): Group {
  const meetings: GroupMeeting[] = rows.map((present, i) => ({
    id: 10 + i,
    startsAt: ago(rows.length - i),
    durationMin: 90,
    status: "done",
    note: "",
    attendance: present === null ? [] : [{ memberId: 1, present }, { memberId: 2, present: true }],
  }));
  for (let i = 0; i < ahead; i += 1) {
    meetings.push({ id: 100 + i, startsAt: new Date(Date.now() + (i + 1) * 24 * HOUR).toISOString(), durationMin: 90, status: "planned", note: "", attendance: [] });
  }
  return {
    id: 1, title: "Опоры", kind: "group", capacity: 8, note: "", about: "",
    format: "offline", place: "", resourceUrl: "", remind24h: true, remind2h: true,
    status: "active", createdAt: ago(60),
    members: [
      { id: 1, clientId: 77, name: "Аня", status: "active" },
      { id: 2, clientId: 78, name: "Борис", status: "active" },
    ],
    meetings, tasks: [], posts: [],
  };
}

// Ярлык «пропадает» решает, напишет ли ведущий человеку до следующей встречи.
// Считать надо пропуски подряд: сумма за всё время загоралась у того, кто
// просто ходит через раз, и ярлык переставали замечать.
describe("пропуски подряд", () => {
  test("три подряд в конце — участник пропадает", () => {
    const g = group([true, true, false, false, false]);
    expect(missStreak(g, 1)).toBe(3);
    expect(isFading(g, 1)).toBe(true);
  });

  test("те же три пропуска вразбивку — не пропадает", () => {
    const g = group([false, true, false, true, false, true]);
    expect(missStreak(g, 1)).toBe(0);
    expect(isFading(g, 1)).toBe(false);
  });

  test("вернулся на последнюю встречу — счётчик обнулён", () => {
    const g = group([false, false, false, true]);
    expect(missStreak(g, 1)).toBe(0);
  });

  test("неотмеченные и будущие встречи не считаются пропуском", () => {
    const g = group([false, false, null], 3);
    expect(missStreak(g, 1)).toBe(2);
    expect(memberStats(g, 1)).toEqual({ been: 0, of: 2, missed: 2 });
  });

  test("до вступления в группу отметок нет — прошлое не вменяется", () => {
    const g = group([true, true]);
    // Участник пришёл позже: в отметках его нет вовсе.
    expect(missStreak(g, 3)).toBe(0);
    expect(memberStats(g, 3)).toEqual({ been: 0, of: 2, missed: 0 });
  });
});

describe("группы клиента", () => {
  const g = group([true]);

  test("находится по карточке клиента", () => {
    expect(groupsOfClient([g], 77).map((x) => x.id)).toEqual([1]);
    expect(groupsOfClient([g], 999)).toEqual([]);
    expect(memberOfClient(g, 78)?.id).toBe(2);
  });

  test("ушедший из состава в карточке не показывается", () => {
    const left: Group = { ...g, members: g.members.map((m) => (m.clientId === 77 ? { ...m, status: "left" as const } : m)) };
    expect(groupsOfClient([left], 77)).toEqual([]);
    expect(memberOfClient(left, 77)).toBeNull();
  });

  test("архивная группа в карточку не попадает", () => {
    expect(groupsOfClient([{ ...g, status: "archived" }], 77)).toEqual([]);
  });
});

describe("подпись срочности", () => {
  const now = new Date("2026-08-25T12:00:00");
  const at = (days: number, hour = 19) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  test("считает по календарным дням, а не по часам", () => {
    expect(untilLabel(at(0, 23), now)).toBe("сегодня");
    expect(untilLabel(at(1, 1), now)).toBe("завтра");
    expect(untilLabel(at(3), now)).toBe("через 3 дня");
    expect(untilLabel(at(5), now)).toBe("через 5 дней");
  });

  test("дальше недели считает неделями", () => {
    expect(untilLabel(at(8), now)).toBe("через 1 неделю");
    expect(untilLabel(at(21), now)).toBe("через 3 недели");
    expect(untilLabel(at(35), now)).toBe("через 5 недель");
  });
});

describe("встреча во времени", () => {
  const meeting = (startsAt: string): GroupMeeting => ({ id: 1, startsAt, durationMin: 90, status: "planned", note: "", attendance: [] });
  const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

  test("идущая встреча ещё не прошедшая", () => {
    const live = meeting(at(-30));
    expect(isOver(live)).toBe(false);
    expect(isLive(live)).toBe(true);
  });

  test("прошедшей встреча становится после конца", () => {
    expect(isOver(meeting(at(-91)))).toBe(true);
    expect(isLive(meeting(at(-91)))).toBe(false);
  });

  test("идущая встреча остаётся ближайшей", () => {
    const g = { ...group([true]), meetings: [meeting(at(-30))] };
    expect(nextMeeting(g)?.id).toBe(1);
  });
});
