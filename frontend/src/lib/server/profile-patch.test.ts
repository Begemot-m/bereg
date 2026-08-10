import { describe, expect, it } from "bun:test";

import { mergeProfilePatch } from "./profile-patch";

const CURRENT = {
  about: "Работаю с тревогой",
  topics: ["Тревога"],
  location: { city: "Москва", district: "Хамовники", address: "", publicExactAddress: false },
};

describe("mergeProfilePatch", () => {
  it("правки с двух устройств не затирают друг друга", () => {
    const first = mergeProfilePatch(CURRENT, { about: "Новый текст о себе" });
    const second = mergeProfilePatch(first.data, { sessionPrice: 4500 });
    expect(second.data.about).toBe("Новый текст о себе");
    expect(second.data.topics).toEqual(["Тревога"]);
    expect(second.fields.sessionPrice).toBe(4500);
  });

  it("колонка обновляется только если поле пришло", () => {
    const { fields } = mergeProfilePatch(CURRENT, { about: "текст" });
    expect(fields).toEqual({});
  });

  it("адрес мержится по частям, город едет в колонку", () => {
    const { data, fields } = mergeProfilePatch(CURRENT, { location: { address: "Пречистенка, 10" } });
    expect(data.location).toEqual({ city: "Москва", district: "Хамовники", address: "Пречистенка, 10", publicExactAddress: false });
    expect(fields.city).toBe("Москва");
  });

  it("ноль и пустая строка — законное «ещё не заполнено»", () => {
    const { fields } = mergeProfilePatch(CURRENT, { sessionPrice: 0, sessionMinutes: 0, format: "" });
    expect(fields.sessionPrice).toBe(0);
    expect(fields.sessionMinutes).toBe(0);
    expect(fields.format).toBe("");
  });

  it("статус в анкету из тела запроса не попадает", () => {
    const { data, fields } = mergeProfilePatch(CURRENT, { status: "approved" });
    expect(data.status).toBeUndefined();
    expect(fields).toEqual({});
  });
});
