import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/server/audit";
import { env } from "@/lib/server/env";
import { emailConfirmationLetter, mailReady, sendMail } from "@/lib/server/mail";
import { issueEmailToken, normalizeEmail } from "@/lib/server/otp";
import { prisma } from "@/lib/server/prisma";
import { clientIp } from "@/lib/server/client-ip";
import { LIMITS, limited } from "@/lib/server/rate-limit";
import { AuthError, requireUser } from "@/lib/server/session";
import { assertSameOrigin } from "@/lib/server/sessions";

export const runtime = "nodejs";

const bindSchema = z.object({ email: z.string().trim().email() });

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({ email: user.email, verified: Boolean(user.emailVerifiedAt) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

/**
 * Привязать почту к аккаунту. Делается только изнутри мини-приложения, где
 * человек уже подтверждён Telegram: почта добавляет второй ключ к тому же
 * аккаунту, а не создаёт новый. До подтверждения адрес не становится вторым
 * способом входа.
 */
export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const stop = limited(req, "email-bind", LIMITS.write);
    if (stop) return stop;

    const user = await requireUser(req);
    const parsed = bindSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Проверьте адрес почты" }, { status: 422 });
    const email = normalizeEmail(parsed.data.email);

    // Один адрес — один аккаунт: иначе по нему можно было бы войти в чужой.
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken && taken.id !== user.id) {
      return NextResponse.json({ error: "Эта почта уже привязана к другому аккаунту" }, { status: 409 });
    }

    if (user.email === email && user.emailVerifiedAt) {
      return NextResponse.json({ ok: true, email, verified: true });
    }
    if (env.isProd && !mailReady()) {
      return NextResponse.json({ error: "Отправка почты временно недоступна" }, { status: 503 });
    }

    await prisma.user.update({
      where: { id: user.id },
      // Смена адреса сбрасывает подтверждение: подтверждён тот адрес,
      // через который реально вошли.
      data: { email, emailVerifiedAt: user.email === email ? user.emailVerifiedAt : null },
    });
    const token = await issueEmailToken(email, clientIp(req));
    const confirmUrl = new URL("/api/auth/email/confirm", env.appUrl);
    confirmUrl.searchParams.set("token", token);
    await sendMail({ to: email, ...emailConfirmationLetter(confirmUrl.toString()) });
    await audit(req, { userId: user.id, action: "email.bind" });

    return NextResponse.json({ ok: true, email, verified: false, message: "Ссылка для подтверждения отправлена на почту" });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

/** Отвязать почту: вход останется только через Telegram. */
export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    await prisma.user.update({ where: { id: user.id }, data: { email: null, emailVerifiedAt: null } });
    await audit(req, { userId: user.id, action: "email.unbind" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
