import { NextResponse, type NextRequest } from "next/server";

import { BOT_NAME } from "@/lib/brand";
import { clientIp } from "@/lib/server/client-ip";
import { CODE_TTL_MS, codePayload, hashCode, newCode } from "@/lib/server/login-codes";
import { prisma } from "@/lib/server/prisma";
import { LIMITS, limited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Начало входа с компьютера: выдаём одноразовый код и ссылку, которую сайт
 * покажет QR-кодом. Вход тут ещё не происходит — код ничей, пока его не
 * подтвердят в Telegram.
 *
 * Ответ намеренно ничего не знает о пользователе: этот роут открыт всем, и по
 * нему нельзя ни узнать, ни угадать чужой аккаунт.
 */
export async function POST(req: NextRequest) {
  const stop = limited(req, "qr-login", LIMITS.auth);
  if (stop) return stop;

  const code = newCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.loginCode.create({
    data: {
      codeHash: hashCode(code),
      expiresAt,
      ip: clientIp(req),
      userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    },
  });

  // Заодно подчищаем протухшее: отдельного задания ради одной таблицы
  // заводить незачем, а строк тут немного.
  void prisma.loginCode
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 3600_000) } } })
    .catch(() => {});

  return NextResponse.json({
    code,
    link: `https://t.me/${BOT_NAME}?start=${codePayload(code)}`,
    expiresAt: expiresAt.toISOString(),
  });
}
