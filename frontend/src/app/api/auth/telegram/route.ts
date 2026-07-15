import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/server/env";
import { createAccessToken, createRefreshToken } from "@/lib/server/jwt";
import { prisma } from "@/lib/server/prisma";
import { InitDataError, validateInitData } from "@/lib/server/telegram";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { init_data } = (await req.json()) as { init_data?: string };

  let tgUser;
  try {
    tgUser = validateInitData(init_data ?? "", env.telegramBotToken, env.initDataMaxAgeSeconds);
  } catch (e) {
    const msg = e instanceof InitDataError ? e.message : "invalid initData";
    return NextResponse.json({ error: `Invalid initData: ${msg}` }, { status: 401 });
  }

  // Апсерт пользователя-психолога по Telegram id.
  const user = await prisma.user.upsert({
    where: { telegramId: tgUser.telegramId },
    create: {
      telegramId: tgUser.telegramId,
      username: tgUser.username,
      firstName: tgUser.firstName,
    },
    update: { username: tgUser.username, firstName: tgUser.firstName },
  });

  return NextResponse.json({
    access_token: await createAccessToken(user.id),
    refresh_token: await createRefreshToken(user.id),
    token_type: "bearer",
  });
}
