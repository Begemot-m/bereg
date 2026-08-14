import { describe, expect, mock, test } from "bun:test";

// Сквозная проверка того, ради чего анкету вообще заполняют: всё, что психолог
// ввёл в профиле, должно доехать до карточки каталога. Раньше поля терялись
// по дороге молча — ни ссылок, ни правил в выдаче не было, а понять это можно
// было только глазами на проде.
mock.module("./prisma", () => ({
  prisma: {
    psyProfile: { findMany: async () => [] },
    workHours: { findMany: async () => [] },
    slotOverride: { findMany: async () => [] },
    appointment: { findMany: async () => [], groupBy: async () => [] },
    review: { groupBy: async () => [] },
  },
}));

const { buildPsyCards } = await import("./psy-card");
const { mergeProfilePatch } = await import("./profile-patch");
const { apiPsyToCatalogPsy } = await import("../catalog");

// Ровно то тело, которое шлёт браузер: анкета уезжает на сервер полями.
const patch = {
  name: "Мария Ветрова",
  primaryMethod: "Гештальт",
  methods: ["Гештальт", "EMDR"],
  experienceYears: "7",
  sessionPrice: 4200,
  sessionMinutes: 60,
  format: "both",
  topics: ["тревога", "отношения"],
  avoids: ["зависимости"],
  languages: ["русский"],
  specialistTypes: ["Психолог", "Гештальт-терапевт"],
  education: ["МГУ, клиническая психология"],
  about: "Работаю в диалоге",
  firstSession: "Знакомимся и сверяем запрос",
  style: "мягкий и поддерживающий",
  quote: "Рядом можно быть неидеальным",
  tg: "@vetrova",
  links: [{ kind: "site", url: "https://vetrova.ru" }],
  photos: ["data:image/png;base64,AAAA"],
  showStats: false,
  gender: "woman",
  rules: {
    cancel: { text: "Бесплатно за 24 часа до встречи.", shown: true },
    contact: { text: "Пишите в любое время.", shown: false },
  },
  location: { city: "Казань", district: "Вахитовский", metro: "Кремлёвская", address: "ул. Баумана, 1", publicExactAddress: true },
};

function cardFromPatch() {
  const { data, fields } = mergeProfilePatch({}, patch);
  return buildPsyCards([
    {
      userId: 42,
      name: fields.name ?? "",
      primaryMethod: fields.primaryMethod ?? "",
      experienceYears: fields.experienceYears ?? 0,
      sessionPrice: fields.sessionPrice ?? 0,
      sessionMinutes: fields.sessionMinutes ?? 0,
      format: fields.format ?? "",
      city: fields.city ?? "",
      status: "approved",
      reviewedAt: new Date(),
      data,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  ]);
}

describe("анкета доезжает до каталога", () => {
  test("поля профиля попадают в карточку", async () => {
    const [card] = await cardFromPatch();

    expect(card.name).toBe("Мария Ветрова");
    expect(card.method).toBe("Гештальт");
    expect(card.methods).toEqual(["Гештальт", "EMDR"]);
    expect(card.years).toBe(7);
    expect(card.price).toBe(4200);
    expect(card.minutes).toBe(60);
    expect(card.format).toBe("both");
    expect(card.topics).toEqual(["тревога", "отношения"]);
    expect(card.avoids).toEqual(["зависимости"]);
    expect(card.languages).toEqual(["русский"]);
    expect(card.specialistTypes).toEqual(["Психолог", "Гештальт-терапевт"]);
    expect(card.education).toEqual(["МГУ, клиническая психология"]);
    expect(card.about).toBe("Работаю в диалоге");
    expect(card.firstSession).toBe("Знакомимся и сверяем запрос");
    expect(card.style).toBe("мягкий и поддерживающий");
    expect(card.quote).toBe("Рядом можно быть неидеальным");
    expect(card.gender).toBe("woman");
    expect(card.showStats).toBe(false);
    expect(card.city).toBe("Казань");
    expect(card.district).toBe("Вахитовский");
    expect(card.metro).toBe("Кремлёвская");
    expect(card.address).toBe("ул. Баумана, 1");
    expect(card.verified).toBe(true);
  });

  test("счётчики платформы молчат, пока их не включили", async () => {
    // Анкеты, заполненные до появления переключателя, поля showStats не имеют:
    // карточка не должна показывать по ним нули за специалиста.
    const { showStats: _dropped, ...withoutFlag } = patch;
    const { data, fields } = mergeProfilePatch({}, withoutFlag);
    const [card] = await buildPsyCards([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { userId: 43, name: fields.name ?? "", primaryMethod: "", experienceYears: 0, sessionPrice: 0, sessionMinutes: 0, format: "", city: "", status: "approved", reviewedAt: new Date(), data } as any,
    ]);
    expect(card.showStats).toBe(false);
    expect(apiPsyToCatalogPsy(JSON.parse(JSON.stringify(card))).showStats).toBe(false);
  });

  test("контакты и ссылки не теряются", async () => {
    const [card] = await cardFromPatch();
    expect(card.tg).toBe("vetrova");
    expect(card.links).toEqual([{ kind: "site", url: "https://vetrova.ru" }]);
    expect(card.portrait).toBe("data:image/png;base64,AAAA");
  });

  test("правила уходят в каталог только отмеченные", async () => {
    const [card] = await cardFromPatch();
    expect(card.rules.map((rule) => rule.id)).toEqual(["cancel"]);
    expect(card.rules[0].text).toBe("Бесплатно за 24 часа до встречи.");
    expect(card.rules[0].title).toBe("Отмена и перенос");
  });

  test("карточка переживает дорогу до браузера", async () => {
    const [card] = await cardFromPatch();
    const psy = apiPsyToCatalogPsy(JSON.parse(JSON.stringify(card)));
    expect(psy.rules?.map((rule) => rule.id)).toEqual(["cancel"]);
    expect(psy.links).toEqual([{ kind: "site", url: "https://vetrova.ru" }]);
    expect(psy.topics).toEqual(["тревога", "отношения"]);
    expect(psy.style).toBe("мягкий и поддерживающий");
    expect(psy.tg).toBe("vetrova");
    expect(psy.showStats).toBe(false);
  });

  test("правка анкеты не стирает соседние поля", async () => {
    const { data: first } = mergeProfilePatch({}, patch);
    const { data: second } = mergeProfilePatch(first, { quote: "Новая цитата" });
    expect(second.quote).toBe("Новая цитата");
    expect(second.rules).toEqual(patch.rules);
    expect(second.links).toEqual(patch.links);
    expect(second.topics).toEqual(patch.topics);
  });
});
