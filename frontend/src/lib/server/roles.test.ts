import { describe, expect, test } from "bun:test";

import { hasRole, psyStatusOf, rolesOf } from "./roles";

// Роль решается только по массиву: старая строка `role` не читается с релиза
// от 8 августа 2026.
describe("роли аккаунта", () => {
  test("массив читается как есть", () => {
    expect(rolesOf({ roles: ["client", "psychologist"] })).toEqual(["client", "psychologist"]);
  });

  test("пустой массив — клиент, а не аккаунт без ролей", () => {
    expect(rolesOf({ roles: [] })).toEqual(["client"]);
    expect(rolesOf({ roles: null })).toEqual(["client"]);
  });

  test("психолог остаётся и клиентом: своя терапия у него не отбирается", () => {
    expect(hasRole({ roles: ["client", "psychologist"] }, "client")).toBe(true);
  });

  test("клиент не получает прав психолога", () => {
    expect(hasRole({ roles: ["client"] }, "psychologist")).toBe(false);
  });

  test("мусор в массиве отбрасывается, а не проходит дальше", () => {
    expect(rolesOf({ roles: ["client", "superadmin"] })).toEqual(["client"]);
  });

  test("пустая запись — обычный клиент, а не аккаунт без ролей", () => {
    expect(rolesOf({})).toEqual(["client"]);
  });
});

describe("статус верификации", () => {
  test("известные значения проходят", () => {
    expect(psyStatusOf({ psyStatus: "approved" })).toBe("approved");
    expect(psyStatusOf({ psyStatus: "review" })).toBe("review");
  });

  test("пустое и неизвестное значение — none, а не подтверждён", () => {
    expect(psyStatusOf({})).toBe("none");
    expect(psyStatusOf({ psyStatus: "" })).toBe("none");
    expect(psyStatusOf({ psyStatus: "verified" })).toBe("none");
  });
});
