import { describe, expect, test } from "bun:test";

import { clientIp, clientIpKey } from "./client-ip";

const req = (headers: Record<string, string>) => new Request("https://chronika.space/api/x", { headers });

describe("адрес клиента за прокси", () => {
  test("берёт адрес, дописанный прокси, а не присланный клиентом", () => {
    // Ровно та атака, ради которой это и переписано: клиент шлёт свой
    // X-Forwarded-For, Caddy дописывает настоящий адрес в конец.
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  test("одиночный адрес — он и есть настоящий", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  test("лишние пробелы и пустые элементы не сбивают разбор", () => {
    expect(clientIp(req({ "x-forwarded-for": " 1.2.3.4 ,, 203.0.113.9 , " }))).toBe("203.0.113.9");
  });

  test("без X-Forwarded-For откатывается на X-Real-IP", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  test("совсем без заголовков — null, а ключ лимита всё равно есть", () => {
    expect(clientIp(req({}))).toBeNull();
    expect(clientIpKey(req({}))).toBe("unknown");
  });

  test("подделка не даёт каждому запросу свой ключ лимита", () => {
    // Раньше так обходились лимиты входа: свежий ключ на каждый запрос.
    const first = clientIpKey(req({ "x-forwarded-for": "10.0.0.1, 203.0.113.9" }));
    const second = clientIpKey(req({ "x-forwarded-for": "10.0.0.2, 203.0.113.9" }));
    expect(first).toBe(second);
  });
});
