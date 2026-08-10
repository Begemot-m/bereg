import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { verifyInviteToken } from "@/lib/server/jwt";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

// Приём приглашения. Раньше метка из ссылки ложилась в sessionStorage и там
// оставалась: связать карточку с аккаунтом было нечем, и «Ждём подключения…»
// висело вечно, а психолог не видел ни настроения клиента, ни его колеса.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await parseBody(req, z.object({ token: z.string().min(1).max(2000) }));

    let clientId: number;
    try {
      clientId = await verifyInviteToken(body.token);
    } catch {
      return NextResponse.json({ error: "Приглашение недействительно" }, { status: 400 });
    }

    const card = await prisma.client.findUnique({ where: { id: clientId } });
    if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (card.userId && card.userId !== user.id) {
      return NextResponse.json({ error: "Карточка уже подключена к другому аккаунту" }, { status: 409 });
    }
    if (card.userId === user.id) return NextResponse.json(card);

    // Имя из профиля может отличаться от того, как карточку подписал психолог.
    // Не переписываем молча: предлагаем заменить в карточке.
    const mine = user.firstName?.trim() ?? "";
    const joinedName = mine && mine.toLowerCase() !== card.name.trim().toLowerCase() ? mine : null;

    const updated = await prisma.client.update({
      where: { id: card.id },
      data: { userId: user.id, link: "joined", joinedName },
    });

    if (card.psychologistId) {
      await prisma.notification.create({
        data: {
          userId: card.psychologistId,
          kind: "system",
          text: `«${card.name}»: профиль подключён — карточка синхронизирована`,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
