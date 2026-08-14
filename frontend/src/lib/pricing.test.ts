import { describe, expect, test } from "bun:test";

import { hasCatalogDecline, PRO_DISCOUNT_PRICE_RUB, PRO_PRICE_RUB, proPriceFor } from "./pricing";

// Цена уходит в счёт ЮKassa, поэтому она считается в одном месте и проверяется:
// разойдись витрина с кассой — человек увидит одну сумму, а спишут другую.
describe("цена подписки", () => {
  test("обычному специалисту — полная", () => {
    expect(proPriceFor("approved")).toBe(PRO_PRICE_RUB);
    expect(proPriceFor("review")).toBe(PRO_PRICE_RUB);
    expect(proPriceFor(null)).toBe(PRO_PRICE_RUB);
    expect(proPriceFor(undefined)).toBe(PRO_PRICE_RUB);
  });

  test("после отказа в каталоге — со скидкой", () => {
    expect(hasCatalogDecline("declined")).toBe(true);
    expect(proPriceFor("declined")).toBe(PRO_DISCOUNT_PRICE_RUB);
  });

  test("«на доработку» скидки не даёт: заявку ещё можно переподать", () => {
    expect(hasCatalogDecline("rejected")).toBe(false);
    expect(proPriceFor("rejected")).toBe(PRO_PRICE_RUB);
  });
});
