import { NextResponse, type NextRequest } from "next/server";

import { assertSameOrigin, clearedCookies, readRefreshCookie, revokeSession } from "@/lib/server/sessions";

export const runtime = "nodejs";

/**
 * Выход из браузера. Гасим сессию по refresh-токену и стираем обе куки: без
 * первого шага украденный токен продолжал бы обновляться, без второго человек
 * остался бы «внутри» до истечения access-токена.
 */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  const token = readRefreshCookie(req);
  if (token) await revokeSession(token);

  const res = NextResponse.json({ ok: true });
  for (const cookie of clearedCookies()) res.cookies.set(cookie);
  return res;
}
