import { describe, expect, test } from "bun:test";

import { TOPICS } from "@/lib/catalog";
import { helpsLine, languagePrepositional, topicInstrumental, yearsWord } from "@/lib/morph";

describe("склонение тем анкеты", () => {
  test("каждая тема каталога склоняется", () => {
    // Именительный падеж в списке — норма, а в предложении «Помогаю с …» он
    // читается как ошибка. Проверяем весь список: тему добавят — тест напомнит.
    const notDeclined = TOPICS.filter((topic) => topicInstrumental(topic) === topic);
    expect(notDeclined).toEqual([]);
  });

  test("знакомые формы", () => {
    expect(topicInstrumental("тревога")).toBe("тревогой");
    expect(topicInstrumental("отношения")).toBe("отношениями");
    expect(topicInstrumental("дети")).toBe("детьми");
    expect(topicInstrumental("пищевое поведение")).toBe("пищевым поведением");
  });

  test("своя формулировка специалиста не портится", () => {
    // Чего правило не знает, то остаётся как есть: лучше именительный падеж,
    // чем выдуманное слово в чужой карточке.
    expect(topicInstrumental("отношения с матерью")).toBe("отношения с матерью");
    expect(topicInstrumental("СДВГ")).toBe("СДВГ");
    expect(topicInstrumental("усталость")).toBe("усталостью");
  });

  test("строка «Помогаю с …»", () => {
    expect(helpsLine(["тревога", "выгорание", "сон", "травма"])).toBe("тревогой, выгоранием, сном");
    expect(helpsLine([])).toBe("разными запросами");
  });

  test("язык и годы", () => {
    expect(languagePrepositional("русский")).toBe("русском");
    expect(languagePrepositional("армянский")).toBe("армянском");
    expect(yearsWord(1)).toBe("год");
    expect(yearsWord(2)).toBe("года");
    expect(yearsWord(7)).toBe("лет");
    expect(yearsWord(11)).toBe("лет");
  });
});
