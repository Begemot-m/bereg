import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { createAccessToken } from "@/lib/server/jwt";
import { checkCode, looksLikeEmail, normalizeEmail } from "@/lib/server/otp";
import { prisma } from "@/lib/server/prisma";
import { LIMITS, limited } from "@/lib/server/rate-limit";
import { accessCookie, createSession, refreshCookie } from "@/lib/server/sessions";

export const runtime = "nodejs";

/**
 * Проверить код и впустить. Новых аккаунтов здесь не создаётся: почта — это
 * второй ключ к существующему аккаунту, а не второй аккаунт.
 */
export async function POST(req: NextRequest) {
  const stop = limited(req, "otp-verify", LIMITS.auth);
  if (stop) return stop;

  const body = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
  const email = normalizeEmail(body.email ?? "");
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!looksLikeEmail(email) || code.length !== 6) {
    return NextResponse.json({ error: "Проверьте почту и код" }, { status: 422 });
  }

  const result = await checkCode(email, code);
  if (!result.ok) {
    const message =
      result.reason === "expired" ? "Код истёк — запросите новый"
      : result.reason === "too_many" ? "Слишком много попыток. Запросите новый код"
      : "Неверный код";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  if (user.blockedAt) return NextResponse.json({ error: "Доступ приостановлен" }, { status: 403 });

  // Первый удачный вход по почте подтверждает адрес.
  if (!user.emailVerifiedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }

  const session = await createSession(user.id, req);
  const access = await createAccessToken(user.id, session.sessionId);
  await audit(req, { userId: user.id, action: "login", meta: { via: "email" } });

  const res = NextResponse.json({ ok: true, user: { id: user.id, role: user.role } });
  res.cookies.set(refreshCookie(session.refreshToken, session.expiresAt));
  res.cookies.set(accessCookie(access));
  return res;
}
