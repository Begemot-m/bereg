import { describe, expect, test } from "bun:test";

import { INVITE_TTL_DAYS, inviteCode, inviteFresh, readInviteCode } from "@/lib/server/invite-code";

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

// Срок именной ссылки: подпись вечная, поэтому «когда пригласили» — вторая
// половина проверки. Иначе пересланная переписка открывает карточку с историей
// спустя год.
describe("срок именного приглашения", () => {
  const day = 86_400_000;
  const now = new Date("2026-08-17T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * day);

  test("свежее приглашение принимается", () => {
    expect(inviteFresh({ invitedAt: ago(1), createdAt: ago(200) }, now)).toBe(true);
  });

  test("отправленное давно — нет", () => {
    expect(inviteFresh({ invitedAt: ago(INVITE_TTL_DAYS + 1), createdAt: ago(200) }, now)).toBe(false);
  });

  test("повторная отправка возвращает ссылку в строй", () => {
    const stale = { invitedAt: ago(90), createdAt: ago(200) };
    expect(inviteFresh(stale, now)).toBe(false);
    expect(inviteFresh({ ...stale, invitedAt: now }, now)).toBe(true);
  });

  test("без отметки об отправке считаем от создания карточки", () => {
    expect(inviteFresh({ invitedAt: null, createdAt: ago(2) }, now)).toBe(true);
    expect(inviteFresh({ invitedAt: null, createdAt: ago(INVITE_TTL_DAYS + 1) }, now)).toBe(false);
  });
});
