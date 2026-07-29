import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { env } from "@/lib/server/env";
import { createAccessToken } from "@/lib/server/jwt";
import { prisma } from "@/lib/server/prisma";
import { LIMITS, limited } from "@/lib/server/rate-limit";
import { accessCookie, createSession, refreshCookie } from "@/lib/server/sessions";
import { InitDataError, validateInitData } from "@/lib/server/telegram";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Подпись initData проверяется криптографически, но перебор всё равно
  // упирается в базу и процессор — ограничиваем по адресу.
  const stop = limited(req, "auth", LIMITS.auth);
  if (stop) return stop;

  const { init_data } = (await req.json()) as { init_data?: string };

  let tgUser;
  try {
    tgUser = validateInitData(init_data ?? "", env.telegramBotToken, env.initDataMaxAgeSeconds);
  } catch (e) {
    const msg = e instanceof InitDataError ? e.message : "invalid initData";
    return NextResponse.json({ error: `Invalid initData: ${msg}` }, { status: 401 });
  }

  // Апсерт пользователя по Telegram id.
  const user = await prisma.user.upsert({
    where: { telegramId: tgUser.telegramId },
    create: {
      telegramId: tgUser.telegramId,
      username: tgUser.username,
      firstName: tgUser.firstName,
    },
    update: { username: tgUser.username, firstName: tgUser.firstName },
  });

  if (user.deletedAt) return NextResponse.json({ error: "Аккаунт удалён" }, { status: 403 });

  const session = await createSession(user.id, req);
  const access = await createAccessToken(user.id, session.sessionId);
  await audit(req, { userId: user.id, action: "login", meta: { via: "telegram" } });

  // Токены уходят только в httpOnly-куки: из JavaScript их не прочитать,
  // поэтому XSS не превращается в угон аккаунта.
  const res = NextResponse.json({ ok: true, user: { id: user.id, role: user.role } });
  res.cookies.set(refreshCookie(session.refreshToken, session.expiresAt));
  res.cookies.set(accessCookie(access));
  return res;
}
