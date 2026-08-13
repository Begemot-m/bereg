import { describe, expect, it } from "bun:test";

import { FREE_CLIENT_LIMIT, hasFreeSeat } from "./access";

describe("hasFreeSeat", () => {
  it("на бесплатном тарифе мест ровно три", () => {
    expect(hasFreeSeat(false, 0)).toBe(true);
    expect(hasFreeSeat(false, FREE_CLIENT_LIMIT - 1)).toBe(true);
    expect(hasFreeSeat(false, FREE_CLIENT_LIMIT)).toBe(false);
  });

  it("сверх лимита приём закрыт, но это не считается ошибкой данных", () => {
    // Так выглядит психолог, у которого кончилась подписка: клиентов больше
    // лимита, новые заявки не проходят, старые карточки остаются.
    expect(hasFreeSeat(false, 6)).toBe(false);
  });

  it("с PRO лимита нет", () => {
    expect(hasFreeSeat(true, 6)).toBe(true);
    expect(hasFreeSeat(true, 100)).toBe(true);
  });
});
