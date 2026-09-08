import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { createAccessToken } from "@/lib/server/jwt";
import { codeState, hashCode } from "@/lib/server/login-codes";
import { prisma } from "@/lib/server/prisma";
import { LIMITS, limited } from "@/lib/server/rate-limit";
import { accessCookie, createSession, refreshCookie } from "@/lib/server/sessions";
import { rolesOf } from "@/lib/server/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Сайт спрашивает, что стало с кодом. Пока «pending» — ждём; как только человек
 * подтвердил в Telegram, тем же ответом уходит сессия в httpOnly-куках.
 *
 * Обмен кода на сессию делается ровно один раз: `usedAt` ставится тем же
 * запросом, что читает код, поэтому две вкладки не получат две сессии.
 */
export async function GET(req: NextRequest) {
  const stop = limited(req, "qr-status", LIMITS.poll);
  if (stop) return stop;

  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (code.length < 16) return NextResponse.json({ state: "unknown" });

  const row = await prisma.loginCode.findUnique({ where: { codeHash: hashCode(code) } });
  const state = codeState(row);
  if (state.state !== "approved" || !state.userId) return NextResponse.json({ state: state.state });

  // Гасим код до выдачи сессии: если что-то упадёт дальше, второй попытки по
  // тому же коду не будет — человек просто обновит QR.
  const claimed = await prisma.loginCode.updateMany({
    where: { id: row!.id, usedAt: null },
    data: { usedAt: new Date(), status: "used" },
  });
  if (claimed.count === 0) return NextResponse.json({ state: "used" });

  const user = await prisma.user.findUnique({ where: { id: state.userId } });
  if (!user || user.deletedAt || user.blockedAt) return NextResponse.json({ state: "rejected" });

  const session = await createSession(user.id, req);
  const access = await createAccessToken(user.id, session.sessionId);
  await audit(req, { userId: user.id, action: "login", meta: { via: "qr" } });

  const res = NextResponse.json({ state: "approved", user: { id: user.id, roles: rolesOf(user) } });
  res.cookies.set(refreshCookie(session.refreshToken, session.expiresAt));
  res.cookies.set(accessCookie(access));
  return res;
}
