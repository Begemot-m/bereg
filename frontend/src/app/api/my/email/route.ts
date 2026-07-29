import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { looksLikeEmail, normalizeEmail } from "@/lib/server/otp";
import { prisma } from "@/lib/server/prisma";
import { LIMITS, limited } from "@/lib/server/rate-limit";
import { AuthError, requireUser } from "@/lib/server/session";
import { assertSameOrigin } from "@/lib/server/sessions";

export const runtime = "nodejs";

/**
 * Привязать почту к аккаунту. Делается только изнутри мини-приложения, где
 * человек уже подтверждён Telegram: почта добавляет второй ключ к тому же
 * аккаунту, а не создаёт новый. Поэтому подтверждать адрес письмом здесь не
 * обязательно — он подтвердится при первом входе по коду.
 */
export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const stop = limited(req, "email-bind", LIMITS.write);
    if (stop) return stop;

    const user = await requireUser(req);
    const body = (await req.json()) as { email?: string };
    const email = normalizeEmail(body.email ?? "");
    if (!looksLikeEmail(email)) return NextResponse.json({ error: "Проверьте адрес почты" }, { status: 422 });

    // Один адрес — один аккаунт: иначе по нему можно было бы войти в чужой.
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken && taken.id !== user.id) {
      return NextResponse.json({ error: "Эта почта уже привязана к другому аккаунту" }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: user.id },
      // Смена адреса сбрасывает подтверждение: подтверждён тот адрес,
      // через который реально вошли.
      data: { email, emailVerifiedAt: user.email === email ? user.emailVerifiedAt : null },
    });
    await audit(req, { userId: user.id, action: "email.bind" });

    return NextResponse.json({ ok: true, email });
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
