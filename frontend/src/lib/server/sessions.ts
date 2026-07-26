import crypto from "node:crypto";

import type { NextRequest } from "next/server";

import { env } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

/**
 * Сессии устройств.
 *
 * Refresh-токен — случайные 32 байта, в базе лежит только его SHA-256.
 * Утечка дампа не даёт войти. При каждом обновлении токен меняется
 * (ротация), а старый помечается заменённым. Если заменённый токен
 * предъявили снова — это признак кражи: гасим всю цепочку (familyId),
 * то есть выкидываем и вора, и владельца, и просим войти заново.
 */

const REFRESH_COOKIE = "bereg_rt";
const ACCESS_COOKIE = "bereg_at";

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

export type IssuedSession = { refreshToken: string; expiresAt: Date; sessionId: string };

function clientMeta(req: NextRequest) {
  return {
    userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    // За обратным прокси реальный адрес приходит в X-Forwarded-For.
    ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
  };
}

export async function createSession(userId: number, req: NextRequest): Promise<IssuedSession> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + env.refreshTtlDays * 86400_000);
  const session = await prisma.session.create({
    data: {
      userId,
      familyId: crypto.randomUUID(),
      tokenHash: sha256(token),
      expiresAt,
      ...clientMeta(req),
    },
  });
  return { refreshToken: token, expiresAt, sessionId: session.id };
}

export class SessionError extends Error {}

/**
 * Обмен refresh-токена на новый. Возвращает id пользователя и свежий токен.
 * Бросает SessionError, если токен неизвестен, истёк, отозван или переиспользован.
 */
export async function rotateSession(refreshToken: string, req: NextRequest) {
  const current = await prisma.session.findUnique({ where: { tokenHash: sha256(refreshToken) } });
  if (!current) throw new SessionError("unknown token");

  // Токен уже меняли — значит предъявили старый. Считаем компрометацией.
  if (current.replacedById || current.revokedAt) {
    await prisma.session.updateMany({
      where: { familyId: current.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new SessionError("token reuse detected");
  }
  if (current.expiresAt.getTime() < Date.now()) throw new SessionError("expired");

  const token = newToken();
  const expiresAt = new Date(Date.now() + env.refreshTtlDays * 86400_000);
  const next = await prisma.session.create({
    data: {
      userId: current.userId,
      familyId: current.familyId,
      tokenHash: sha256(token),
      expiresAt,
      ...clientMeta(req),
    },
  });
  await prisma.session.update({
    where: { id: current.id },
    data: { replacedById: next.id, revokedAt: new Date(), lastUsedAt: new Date() },
  });

  return { userId: current.userId, refreshToken: token, expiresAt, sessionId: next.id };
}

export async function revokeSession(refreshToken: string) {
  await prisma.session.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Выход со всех устройств — например, после смены почты. */
export async function revokeAllSessions(userId: number) {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Уборка просроченных: вызывается ночным заданием. */
export async function purgeExpiredSessions() {
  const cutoff = new Date(Date.now() - 30 * 86400_000);
  await prisma.session.deleteMany({ where: { expiresAt: { lt: cutoff } } });
}

/* ——— Куки ——— */

// httpOnly — недоступны из JS, значит XSS не уносит токен.
// SameSite=Lax — браузер не шлёт их с чужих сайтов, базовая защита от CSRF.
const base = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: "lax" as const,
  path: "/",
};

export const refreshCookie = (token: string, expiresAt: Date) => ({
  name: REFRESH_COOKIE,
  value: token,
  ...base,
  expires: expiresAt,
});

export const accessCookie = (token: string) => ({
  name: ACCESS_COOKIE,
  value: token,
  ...base,
  maxAge: env.accessTtlSeconds,
});

export const clearedCookies = () => [
  { name: REFRESH_COOKIE, value: "", ...base, maxAge: 0 },
  { name: ACCESS_COOKIE, value: "", ...base, maxAge: 0 },
];

export const readRefreshCookie = (req: NextRequest) => req.cookies.get(REFRESH_COOKIE)?.value ?? null;
export const readAccessCookie = (req: NextRequest) => req.cookies.get(ACCESS_COOKIE)?.value ?? null;

/**
 * Защита от CSRF для мутаций: браузер всегда шлёт Origin в POST/PATCH/DELETE.
 * Если он есть и не наш — запрос отклоняем.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // не браузерный запрос (бот, вебхук) — проверяется отдельно
  const allowed = new URL(env.appUrl).origin;
  if (origin !== allowed) throw new SessionError("bad origin");
}
