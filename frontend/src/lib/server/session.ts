import type { NextRequest } from "next/server";

import { verifyAccessToken } from "@/lib/server/jwt";
import { prisma } from "@/lib/server/prisma";
import { readAccessCookie } from "@/lib/server/sessions";

export class AuthError extends Error {}

/**
 * Текущий пользователь запроса.
 *
 * Токен берём из httpOnly-куки; заголовок Authorization оставлен для
 * серверных клиентов и тестов. Дополнительно проверяем, что сессия из
 * токена жива: иначе «выход со всех устройств» не работал бы до истечения
 * access-токена.
 */
export async function requireUser(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = readAccessCookie(req) ?? bearer;
  if (!token) throw new AuthError("missing token");

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    throw new AuthError("invalid token");
  }

  // Сессия и пользователь берутся одним запросом с JOIN, а не двумя подряд.
  // Открытие одного экрана поднимает 6–7 endpoint, каждый звал requireUser —
  // это была дюжина лишних round-trip к базе на каждую навигацию.
  let user;
  if (claims.sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: claims.sessionId },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new AuthError("session revoked");
    }
    if (session.userId !== claims.userId) throw new AuthError("session mismatch");
    user = session.user;
  } else {
    user = await prisma.user.findUnique({ where: { id: claims.userId } });
  }

  if (!user || user.deletedAt) throw new AuthError("user not found");
  // Блокировка действует немедленно: сессии гасятся при блокировке, но
  // живой access-токен иначе доработал бы свои минуты.
  if (user.blockedAt) throw new AuthError("blocked");
  return user;
}
