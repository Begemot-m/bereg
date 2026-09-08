import { describe, expect, test } from "bun:test";

import { APPROVED_TTL_MS, codePayload, codeState, describeClient, hashCode, newCode, readPayload, type CodeRow } from "./login-codes";

const row = (patch: Partial<CodeRow> = {}): CodeRow => ({
  status: "pending",
  userId: null,
  expiresAt: new Date(Date.now() + 60_000),
  approvedAt: null,
  usedAt: null,
  ...patch,
});

describe("коды входа по QR", () => {
  test("код влезает в стартовую метку Telegram", () => {
    for (let i = 0; i < 50; i++) {
      const code = newCode();
      expect(code).toMatch(/^[A-Za-z0-9]{20,28}$/);
      expect(readPayload(codePayload(code))).toBe(code);
    }
  });

  test("чужие и битые метки не проходят", () => {
    expect(readPayload("win_12")).toBeNull();
    expect(readPayload("login_")).toBeNull();
    expect(readPayload("login_короткий")).toBeNull();
    expect(readPayload("login_ab")).toBeNull();
    expect(readPayload("login_" + "a".repeat(64))).toBeNull();
  });

  test("в базе лежит хеш, а не сам код", () => {
    const code = newCode();
    expect(hashCode(code)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode(code)).not.toContain(code);
    expect(hashCode(code)).toBe(hashCode(code));
  });

  test("неизвестный код — не вход", () => {
    expect(codeState(null).state).toBe("unknown");
  });

  test("пока не подтвердили — ждём", () => {
    expect(codeState(row()).state).toBe("pending");
  });

  test("протухший код не пускает", () => {
    expect(codeState(row({ expiresAt: new Date(Date.now() - 1) })).state).toBe("expired");
  });

  test("подтверждённый код отдаёт пользователя", () => {
    const state = codeState(row({ status: "approved", userId: 7, approvedAt: new Date() }));
    expect(state).toEqual({ state: "approved", userId: 7 });
  });

  test("подтверждение живёт своим сроком, а не сроком показа", () => {
    // Одобрили на последней секунде показа: обменять на сессию всё ещё можно.
    const late = row({ status: "approved", userId: 7, approvedAt: new Date(), expiresAt: new Date(Date.now() - 1) });
    expect(codeState(late).state).toBe("approved");

    const stale = row({ status: "approved", userId: 7, approvedAt: new Date(Date.now() - APPROVED_TTL_MS - 1) });
    expect(codeState(stale).state).toBe("expired");
  });

  test("одобренный без пользователя не пускает никого", () => {
    expect(codeState(row({ status: "approved", approvedAt: new Date() })).state).toBe("pending");
  });

  test("использованный код второй сессии не даёт", () => {
    expect(codeState(row({ status: "approved", userId: 7, approvedAt: new Date(), usedAt: new Date() })).state).toBe("used");
    expect(codeState(row({ status: "used", userId: 7 })).state).toBe("used");
  });

  test("отклонённый код остаётся отклонённым", () => {
    expect(codeState(row({ status: "rejected", userId: 7, approvedAt: new Date() })).state).toBe("rejected");
  });

  test("человек узнаёт своё устройство в подписи", () => {
    const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
    expect(describeClient(chrome, "5.5.5.5")).toBe("Chrome · Windows · IP 5.5.5.5");
    expect(describeClient("Mozilla/5.0 (Macintosh) Safari/605.1", null)).toBe("Safari · macOS");
    expect(describeClient(null, null)).toBe("браузер");
  });
});
