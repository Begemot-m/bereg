import { describe, expect, it } from "bun:test";

import { nameSlug } from "@/lib/translit";

describe("nameSlug", () => {
  it("берёт имя и фамилию латиницей", () => {
    expect(nameSlug("Анна Петрова")).toBe("anna-petrova");
    expect(nameSlug("Матвей Горбачёв")).toBe("matvei-gorbachev");
  });

  it("выкидывает цифры и лишние слова — по хвосту ссылки читается id", () => {
    expect(nameSlug("Пётр 2 Иванов Сергеевич")).toBe("petr-ivanov");
    expect(/\d/.test(nameSlug("Анна 1990"))).toBe(false);
  });

  it("без имени возвращает пусто", () => {
    expect(nameSlug("")).toBe("");
    expect(nameSlug(null)).toBe("");
  });
});
