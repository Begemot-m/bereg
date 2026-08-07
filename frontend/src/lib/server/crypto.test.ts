import { beforeAll, describe, expect, test } from "bun:test";

import { decryptBytes, decryptField, encryptBytes, encryptField, encryptionReady } from "./crypto";

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

describe("шифрование файлов документов", () => {
  test("байты возвращаются без изменений", () => {
    const file = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10, 0x7f]); // «PDF» с нулями и старшими битами
    expect(decryptBytes(encryptBytes(file)).equals(file)).toBe(true);
  });

  test("на диск не попадает исходное содержимое", () => {
    const file = Buffer.from("диплом Иванова", "utf8");
    const stored = encryptBytes(file);
    expect(stored.includes(file)).toBe(false);
    expect(stored.length).toBe(file.length + 29); // версия + iv + tag
  });

  test("подменённый байт файла ломает расшифровку", () => {
    const stored = encryptBytes(Buffer.from("скан документа"));
    stored[stored.length - 1] ^= 0xff;
    expect(() => decryptBytes(stored)).toThrow();
  });

  test("чужой формат файла не расшифровывается молча", () => {
    expect(() => decryptBytes(Buffer.from("просто файл на диске"))).toThrow();
  });

  test("пустой файл шифруется и читается", () => {
    expect(decryptBytes(encryptBytes(Buffer.alloc(0))).length).toBe(0);
  });
});
