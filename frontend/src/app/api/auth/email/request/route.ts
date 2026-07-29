import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { otpLetter, sendMail } from "@/lib/server/mail";
import { issueCode, looksLikeEmail, normalizeEmail } from "@/lib/server/otp";
import { prisma } from "@/lib/server/prisma";
import { LIMITS, clientIp, limited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

/**
 * Запросить код входа на почту.
 *
 * Ответ одинаковый и для существующей почты, и для незнакомой. Иначе форма
 * входа превращается в проверялку «зарегистрирован ли такой человек» — а по
 * нашей теме сам факт регистрации уже чувствителен.
 *
 * Почта работает только та, что человек сам привязал внутри мини-приложения:
 * так веб не становится обходом Telegram и не плодит вторые аккаунты.
 */
export async function POST(req: NextRequest) {
  const stop = limited(req, "otp", LIMITS.otp);
  if (stop) return stop;

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = normalizeEmail(body.email ?? "");
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: "Проверьте адрес почты" }, { status: 422 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.deletedAt && !user.blockedAt) {
    const code = await issueCode(email, clientIp(req));
    const letter = otpLetter(code);
    await sendMail({ to: email, ...letter });
    await audit(req, { userId: user.id, action: "otp.request", meta: { via: "email" } });
  }

  return NextResponse.json({ ok: true, message: "Если почта привязана к аккаунту, код уже отправлен." });
}
