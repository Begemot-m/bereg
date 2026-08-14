import { describe, expect, test } from "bun:test";

import { inviteCode, readInviteCode } from "@/lib/server/invite-code";

// Код приглашения — единственное, что стоит между чужой ссылкой и карточкой
// клиента: по нему сервер решает, к какому специалисту привязать человека.
describe("код приглашения", () => {
  test("читается обратно", async () => {
    const code = await inviteCode("psy", 42);
    expect(await readInviteCode("psy", code)).toBe(42);
  });

  test("подходит для ссылки в бота", async () => {
    const code = await inviteCode("card", 12345);
    expect(`psy_${code}`.length).toBeLessThanOrEqual(64);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("подделанный номер не проходит", async () => {
    const code = await inviteCode("psy", 42);
    const forged = code.replace(/^\d+/, "43");
    expect(await readInviteCode("psy", forged)).toBeNull();
  });

  test("код одного вида не годится для другого", async () => {
    const code = await inviteCode("card", 7);
    expect(await readInviteCode("psy", code)).toBeNull();
  });

  test("мусор вместо кода отвергается", async () => {
    expect(await readInviteCode("psy", "12")).toBeNull();
    expect(await readInviteCode("psy", "abc-def")).toBeNull();
    expect(await readInviteCode("psy", "")).toBeNull();
  });
});
