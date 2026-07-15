import type { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { verifyToken } from "@/lib/server/jwt";

export class AuthError extends Error {}

// Достаёт текущего пользователя из заголовка Authorization: Bearer <access>.
// Бросает AuthError — роут превращает это в 401.
export async function requireUser(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AuthError("missing token");

  let userId: number;
  try {
    userId = await verifyToken(token, "access");
  } catch {
    throw new AuthError("invalid token");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError("user not found");
  return user;
}
