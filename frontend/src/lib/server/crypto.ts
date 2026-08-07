// Шифрование чувствительных полей на уровне приложения.
//
// Зачем не ограничиться шифрованием диска у провайдера: оно защищает от кражи
// физического диска и больше ни от чего. Дамп базы, бэкап в S3, доступ
// администратора провайдера — всё это отдаёт данные открытым текстом.
// Здесь ключ живёт в переменной окружения приложения, а не в базе, поэтому
// украденная база без него бесполезна.
//
// AES-256-GCM: шифрует и одновременно подписывает — подменить содержимое
// незаметно нельзя. Реализация из стандартного node:crypto, без зависимостей.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Версия схемы шифрования. Меняем ключ — поднимаем версию и держим обе,
// чтобы старые записи читались, пока не перешифруются при следующей записи.
const VERSION = "v1";

function dataKey(): Buffer {
  const raw = process.env.DATA_KEY;
  if (!raw) throw new Error("DATA_KEY не задан: нечем шифровать чувствительные поля");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("DATA_KEY должен быть 32 байта в base64: openssl rand -base64 32");
  return key;
}

/** Есть ли чем шифровать. В деве без ключа поля хранятся как есть. */
export function encryptionReady(): boolean {
  try { dataKey(); return true; } catch { return false; }
}

/**
 * Зашифровать текст для хранения в базе.
 * Формат: v1:<iv>:<tag>:<ciphertext>, всё в base64.
 */
export function encryptField(plain: string): string {
  if (!plain) return plain;
  const iv = randomBytes(12); // 96 бит — рекомендованный размер для GCM
  const cipher = createCipheriv("aes-256-gcm", dataKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/**
 * Расшифровать. Значение не нашего формата возвращаем как есть — так старые
 * незашифрованные записи продолжают читаться и шифруются при первой же записи.
 */
export function decryptField(stored: string): string {
  if (!stored) return stored;
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) return stored;

  const [, ivB64, tagB64, dataB64] = parts;
  try {
    const decipher = createDecipheriv("aes-256-gcm", dataKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    // Подменённые данные или чужой ключ. Молча отдать мусор нельзя —
    // пусть вызывающий код увидит ошибку и не запишет её обратно поверх.
    throw new Error("Не удалось расшифровать поле: неверный ключ или данные повреждены");
  }
}

/**
 * То же самое для файла. Через base64 гонять нельзя: диплом на 5 МБ раздуется
 * до 6,7 МБ и целиком осядет в памяти строкой. Формат тот же, но заголовок
 * лежит в самом файле: v1 | iv(12) | tag(16) | шифротекст.
 */
const BIN_VERSION = 1;
export function encryptBytes(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey(), iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from([BIN_VERSION]), iv, cipher.getAuthTag(), data]);
}

export function decryptBytes(stored: Buffer): Buffer {
  if (stored.length < 29 || stored[0] !== BIN_VERSION) {
    throw new Error("Файл не в формате хранилища: чужой ключ или повреждение");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", dataKey(), stored.subarray(1, 13));
    decipher.setAuthTag(stored.subarray(13, 29));
    return Buffer.concat([decipher.update(stored.subarray(29)), decipher.final()]);
  } catch {
    throw new Error("Не удалось расшифровать файл: неверный ключ или данные повреждены");
  }
}

/** Удобные обёртки для полей, которых может не быть. */
export const encryptNullable = (v: string | null | undefined) => (v == null ? v : encryptField(v));
export const decryptNullable = (v: string | null | undefined) => (v == null ? v : decryptField(v));
