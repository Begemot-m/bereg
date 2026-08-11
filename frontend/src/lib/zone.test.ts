import { describe, expect, it } from "bun:test";

import { sameZoneDay, zoneAt, zoneDay, zoneDayDiff, zoneDayNumber, zoneWeekday } from "./zone";

// Браузер рисовал время в поясе устройства, а сервер отдавал его в поясе
// платформы: психолог из Екатеринбурга выставлял «10:00» и в своей же неделе
// видел «12:00». Здесь проверяется клиентская половина — она обязана резать
// сутки так же, как сервер, независимо от зоны машины с тестами.

const ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || process.env.APP_TIME_ZONE || "Europe/Moscow";
const moscow = ZONE === "Europe/Moscow";

describe("zoneAt", () => {
  it.if(moscow)("строит окно по настенным часам платформы", () => {
    expect(zoneAt("2030-01-07", 10, 0)?.toISOString()).toBe("2030-01-07T07:00:00.000Z");
  });

  it("возвращает тот же календарный день и число", () => {
    const at = zoneAt("2030-01-07", 23, 30)!;
    expect(zoneDayNumber(at)).toBe(7);
    expect(zoneWeekday(at)).toBe(0); // 7 января 2030 — понедельник
  });
});

describe("границы суток", () => {
  it.if(moscow)("поздний вечер платформы остаётся в своём дне", () => {
    // 23:30 в Москве — это уже следующие сутки в Екатеринбурге, но день
    // расписания определяется платформой.
    const at = new Date("2030-01-07T20:30:00.000Z");
    expect(sameZoneDay(at, zoneDay("2030-01-07"))).toBe(true);
    expect(sameZoneDay(at, zoneDay("2030-01-08"))).toBe(false);
  });

  it.if(moscow)("«сегодня / завтра» считаются по календарю платформы", () => {
    const evening = new Date("2030-01-07T20:30:00.000Z"); // 23:30 в Москве
    expect(zoneDayDiff(evening, new Date("2030-01-07T19:00:00.000Z"))).toBe(0);
    // Полночь платформы — уже завтра, хотя у устройства восточнее она прошла
    // двумя часами раньше.
    expect(zoneDayDiff(evening, new Date("2030-01-07T21:30:00.000Z"))).toBe(1);
    expect(zoneDayDiff(evening, new Date("2030-01-08T06:00:00.000Z"))).toBe(1);
  });
});
