import { describe, expect, it } from "bun:test";

import { slotsFor, type WorkHoursDTO } from "./schedule";
import { weekdayOf, zonedTime, zoneHour, zoneYmd } from "./zone";

// Прод крутится в контейнере без TZ, то есть в UTC. Пока окна считались по
// времени процесса, «10:00» из графика уезжало клиенту как 10:00Z, и в карточке
// специалиста в Москве стояло 13:00. Эти проверки не зависят от зоны машины,
// на которой их запускают, — в этом и смысл.

const ZONE = process.env.APP_TIME_ZONE || "Europe/Moscow";

describe("zonedTime", () => {
  it.if(ZONE === "Europe/Moscow")("считает настенное время Москвы, а не UTC", () => {
    expect(zonedTime(2030, 1, 7, 10, 0).toISOString()).toBe("2030-01-07T07:00:00.000Z");
  });

  it("день и час момента берутся в зоне платформы", () => {
    const at = zonedTime(2030, 1, 7, 23, 30);
    expect(zoneYmd(at)).toBe("2030-01-07");
    expect(zoneHour(at)).toBe(23);
  });
});

describe("slotsFor", () => {
  const date = "2030-01-07";
  const work = (): WorkHoursDTO => ({
    hours: { [weekdayOf(date)]: [{ t: "10:00", d: 50, fmt: "online" }] },
    sessionMinutes: 50,
    cancelLockDays: 0,
    leadDaysOffline: 0,
    leadDaysOnline: 0,
    dayFrom: 9,
    dayTo: 21,
  });

  it("окно шаблона попадает на то же настенное время", () => {
    const [slot] = slotsFor(work(), date, [], {});
    expect(zoneYmd(new Date(slot.start))).toBe(date);
    expect(zoneHour(new Date(slot.start))).toBe(10);
  });

  it("снятое окно ищется по тому же ISO, что отдаёт расчёт", () => {
    const iso = zonedTime(2030, 1, 7, 10, 0).toISOString();
    expect(slotsFor(work(), date, [], { [iso]: { removed: true } })).toEqual([]);
  });
});
