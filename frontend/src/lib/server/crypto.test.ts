import { beforeAll, describe, expect, test } from "bun:test";

import { decryptField, encryptField, encryptionReady } from "./crypto";

// Ключ теста, не боевой.
beforeAll(() => {
  process.env.DATA_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("шифрование чувствительных полей", () => {
  test("что зашифровали, то и расшифровали", () => {
    const text = "Клиент говорит, что стало легче. Продолжаем экспозицию.";
    expect(decryptField(encryptField(text))).toBe(text);
  });

  test("русский текст и эмодзи не портятся", () => {
    const text = "Настроение 4/5 🙂 — «важно не забыть про сон»";
    expect(decryptField(encryptField(text))).toBe(text);
  });

  test("одинаковый текст даёт разный шифротекст", () => {
    // Иначе по совпадению записей видно, что два человека написали одно и то же.
    expect(encryptField("привет")).not.toBe(encryptField("привет"));
  });

  test("подмена шифротекста ломает расшифровку, а не проходит молча", () => {
    const enc = encryptField("важная заметка");
    const parts = enc.split(":");
    const data = Buffer.from(parts[3], "base64");
    data[0] ^= 0xff; // портим один байт
    const tampered = [parts[0], parts[1], parts[2], data.toString("base64")].join(":");
    expect(() => decryptField(tampered)).toThrow();
  });

  test("старая незашифрованная запись читается как есть", () => {
    // Путь миграции: строки без нашего формата возвращаются нетронутыми.
    expect(decryptField("обычный текст из старой базы")).toBe("обычный текст из старой базы");
  });

  test("пустое значение проходит насквозь", () => {
    expect(encryptField("")).toBe("");
    expect(decryptField("")).toBe("");
  });

  test("готовность определяется наличием ключа", () => {
    expect(encryptionReady()).toBe(true);
  });
});
