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

  if (claims.sessionId) {
    const session = await prisma.session.findUnique({ where: { id: claims.sessionId } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new AuthError("session revoked");
    }
  }

  const user = await prisma.user.findUnique({ where: { id: claims.userId } });
  if (!user || user.deletedAt) throw new AuthError("user not found");
  // Блокировка действует немедленно: сессии гасятся при блокировке, но
  // живой access-токен иначе доработал бы свои минуты.
  if (user.blockedAt) throw new AuthError("blocked");
  return user;
}
