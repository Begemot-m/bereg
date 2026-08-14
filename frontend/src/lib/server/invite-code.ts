import { env } from "@/lib/server/env";

/**
 * Короткий код приглашения для ссылки в бота.
 *
 * JWT сюда не годится: Telegram пускает в `startapp` не больше 64 символов из
 * набора `A-Za-z0-9_-`, а подписанный токен и длиннее, и с точками. Поэтому
 * код — это номер и усечённая подпись: `12-Ab3xY9pQ`. Подделать её нельзя,
 * перебрать 48 бит на живом сервере — тоже.
 */

const enc = new TextEncoder();

async function sign(kind: string, id: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(env.jwtSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${kind}:${id}`));
  const bytes = new Uint8Array(mac);
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 10);
}

export type InviteKind = "psy" | "card";

export async function inviteCode(kind: InviteKind, id: number): Promise<string> {
  return `${id}-${await sign(kind, id)}`;
}

/** Номер из кода или null, если подпись не сходится. */
export async function readInviteCode(kind: InviteKind, code: string): Promise<number | null> {
  const [head, tail] = code.split("-");
  const id = Number(head);
  if (!Number.isInteger(id) || id <= 0 || !tail) return null;
  const expected = await sign(kind, id);
  // Длина фиксированная, поэтому сравнение обычное: тайминг тут ничего не
  // выдаёт — подпись всё равно нельзя подобрать по одному символу.
  return tail === expected ? id : null;
}
