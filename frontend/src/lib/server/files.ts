// Файловое хранилище для документов верификации. S3 в проекте нет осознанно,
// поэтому файлы лежат на диске сервера рядом с бэкапами — в томе, который
// монтируется в контейнер (UPLOAD_DIR, по умолчанию /opt/bereg/uploads).
//
// На диск кладём только зашифрованное: чужой диплом — персональные данные, и
// доступ к файловой системе не должен означать доступ к содержимому. Ключ тот
// же DATA_KEY, что у полей базы: без него дамп диска бесполезен.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { decryptBytes, encryptBytes, encryptionReady } from "./crypto";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/opt/bereg/uploads";

/** Имя файла в хранилище: случайное, без исходного имени и расширения. */
export function newStorageKey(): string {
  return randomBytes(16).toString("hex");
}

function fullPath(key: string): string {
  // Ключ приходит из базы, но проверяем всё равно: подставленный «../» увёл бы
  // запись и чтение за пределы тома.
  if (!/^[a-f0-9]{32}$/.test(key)) throw new Error("Некорректный ключ хранилища");
  return path.join(UPLOAD_DIR, key);
}

export async function saveFile(key: string, bytes: Buffer): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  // В деве без DATA_KEY поля базы хранятся как есть — файлы ведут себя так же,
  // иначе локальная разработка требовала бы ключа.
  await writeFile(fullPath(key), encryptionReady() ? encryptBytes(bytes) : bytes, { mode: 0o600 });
}

export async function readStoredFile(key: string): Promise<Buffer> {
  const raw = await readFile(fullPath(key));
  if (!encryptionReady()) return raw;
  return decryptBytes(raw);
}

/** Удаление по требованию об удалении ПД: файла не должно остаться на диске. */
export async function deleteStoredFile(key: string): Promise<void> {
  await rm(fullPath(key), { force: true });
}
