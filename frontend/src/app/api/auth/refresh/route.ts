import { NextResponse, type NextRequest } from "next/server";

import { createAccessToken } from "@/lib/server/jwt";
import { prisma } from "@/lib/server/prisma";
import {
  accessCookie,
  assertSameOrigin,
  clearedCookies,
  readRefreshCookie,
  refreshCookie,
  rotateSession,
  SessionError,
} from "@/lib/server/sessions";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  const token = readRefreshCookie(req);
  if (!token) return NextResponse.json({ error: "missing refresh token" }, { status: 401 });

  let rotated;
  try {
    rotated = await rotateSession(token, req);
  } catch (e) {
    // Переиспользование старого токена уже погасило всю цепочку в rotateSession.
    const res = NextResponse.json(
      { error: e instanceof SessionError ? e.message : "invalid refresh token" },
      { status: 401 },
    );
    for (const cookie of clearedCookies()) res.cookies.set(cookie);
    return res;
  }

  const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
  if (!user || user.deletedAt) {
    const res = NextResponse.json({ error: "user not found" }, { status: 401 });
    for (const cookie of clearedCookies()) res.cookies.set(cookie);
    return res;
  }

  const access = await createAccessToken(user.id, rotated.sessionId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(refreshCookie(rotated.refreshToken, rotated.expiresAt));
  res.cookies.set(accessCookie(access));
  return res;
}
