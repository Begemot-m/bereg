/**
 * Реквизиты и параметры, на которые ссылаются все публичные документы.
 * Меняем здесь — меняется во всех текстах сразу. Дата редакции входит в
 * согласия, поэтому правим её вместе с текстом одним коммитом.
 */
export const LEGAL = {
  operator: "Горба Матвей Михайлович",
  operatorShort: "Горба М. М.",
  status: "самозанятый, плательщик налога на профессиональный доход",
  inn: "784203190925",
  registeredSince: "23 марта 2026 года",
  /** Пусто — в текстах пишем «адрес по запросу». Заполнить перед модерацией ЮKassa. */
  address: "",
  region: "Санкт-Петербург",
  email: "m.m.gorba@gmail.com",
  service: "Хроника",
  site: "chronika.space",
  /** Должно совпадать с SUBSCRIPTION_PRICE_RUB на сервере. */
  priceRub: 990,
  periodDays: 30,
  version: "2026-08-09",
} as const;

export const LEGAL_DOCS = [
  { href: "/docs/terms", title: "Пользовательское соглашение", hint: "Правила работы сервиса" },
  { href: "/policy", title: "Политика конфиденциальности", hint: "Что делаем с данными" },
  { href: "/docs/offer", title: "Публичная оферта", hint: "Договор на подписку PRO" },
  { href: "/docs/consent", title: "Согласие на обработку ПД", hint: "Текст согласия" },
  { href: "/docs/refund", title: "Политика возвратов", hint: "Отказ и возврат денег" },
] as const;

export const dayPrice = Math.round(LEGAL.priceRub / LEGAL.periodDays);
