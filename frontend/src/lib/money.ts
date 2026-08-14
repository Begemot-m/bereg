// Стоимость встречи в рублях или в валюте: специалисты за пределами России
// берут оплату в долларах и евро, и каталог должен уметь их показывать и
// фильтровать. Валюта живёт рядом с ценой — и в анкете, и в карточке.

export type Currency = "RUB" | "USD" | "EUR";

export const CURRENCIES: { code: Currency; symbol: string; label: string; short: string }[] = [
  { code: "RUB", symbol: "₽", label: "Рубли", short: "₽ рубли" },
  { code: "USD", symbol: "$", label: "Доллары", short: "$ доллары" },
  { code: "EUR", symbol: "€", label: "Евро", short: "€ евро" },
];

export const isCurrency = (value: unknown): value is Currency => value === "RUB" || value === "USD" || value === "EUR";
/** Молчание старых анкет читаем как рубли: до валюты все цены были рублёвыми. */
export const toCurrency = (value: unknown): Currency => (isCurrency(value) ? value : "RUB");
export const currencySymbol = (currency: Currency) => CURRENCIES.find((item) => item.code === currency)!.symbol;

/** Нижняя граница шкалы: 1000 ₽ и 10 в валюте — так просил владелец. */
export const MIN_PRICE: Record<Currency, number> = { RUB: 1000, USD: 10, EUR: 10 };

/**
 * Ступени шкалы бюджета. Ползунок ходит по индексам, последнее деление —
 * «без верхней границы»: снизу шкала ограничена, сверху нет.
 */
export const PRICE_STEPS: Record<Currency, number[]> = {
  RUB: [1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 8000, 10000, 15000, 20000],
  USD: [10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300],
  EUR: [10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300],
};

/** Номер деления на шкале для потолка цены. null (без границы) — последнее. */
export function priceIndex(max: number | null, currency: Currency): number {
  const steps = PRICE_STEPS[currency];
  if (max == null) return steps.length;
  const index = steps.findIndex((step) => step >= max);
  return index < 0 ? steps.length : index;
}

/** Потолок цены по номеру деления. Последнее деление — «до бесконечности». */
export function priceAt(index: number, currency: Currency): number | null {
  const steps = PRICE_STEPS[currency];
  return index >= steps.length ? null : steps[Math.max(0, index)];
}

export function formatMoney(value: number, currency: Currency = "RUB"): string {
  const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(value));
  return currency === "RUB" ? `${number} ₽` : `${currencySymbol(currency)}${number}`;
}

/** Подпись шкалы: «от 1000 ₽ до 3500 ₽» или «от 1000 ₽ и выше». */
export function budgetLabel(max: number | null, currency: Currency): string {
  const from = formatMoney(MIN_PRICE[currency], currency);
  return max == null ? `от ${from} и выше` : `от ${from} до ${formatMoney(max, currency)}`;
}

/** Проходит ли цена по выбранной шкале. Валюта должна совпадать. */
export function priceFitsScale(price: number, priceCurrency: Currency, max: number | null, currency: Currency): boolean {
  if (priceCurrency !== currency) return false;
  if (price < MIN_PRICE[currency]) return false;
  return max == null || price <= max;
}
