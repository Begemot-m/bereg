import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NOT_APPROVED } from "@/lib/server/access";
import { addContactClients } from "@/lib/server/contacts";
import { PHOTO_INCLUDE, withPhoto, withStatsOne } from "@/lib/server/clients";
import { env } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ username: z.string().trim().min(2).max(64) });

const api = (method: string) => `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;

type Chat = {
  ok: boolean;
  result?: {
    id: number;
    type: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo?: { small_file_id: string; big_file_id: string };
  };
};

/**
 * Быстрый путь: специалист вводит ник, а не уходит выбирать контакт в чат
 * бота. Telegram отдаёт по нику имя и аватарку — карточка появляется с лицом
 * сразу, не выходя из приложения. Ник не найден (закрытый профиль, опечатка) —
 * заводим карточку всё равно: имя психолог поправит, а «Написать» по нику
 * работает и так.
 */
async function lookup(username: string) {
  try {
    const res = await fetch(api("getChat") + `?chat_id=@${encodeURIComponent(username)}`);
    const data = (await res.json()) as Chat;
    const chat = data.ok ? data.result : undefined;
    if (!chat || chat.type !== "private") return null;
    return {
      userId: chat.id,
      name: [chat.first_name, chat.last_name].filter(Boolean).join(" ") || username,
      username: chat.username ?? username,
      photoId: chat.photo?.big_file_id ?? chat.photo?.small_file_id ?? null,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { username } = await parseBody(req, schema);
    const nick = username.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");

    const found = await lookup(nick);
    const result = await addContactClients(user.id, [found ?? { name: nick, username: nick }]);
    if (!result.approved) return NextResponse.json(NOT_APPROVED, { status: 403 });
    if (result.limited || !result.added.length) {
      return NextResponse.json(
        { error: "limit_reached", message: "На бесплатном тарифе места закончились. Подключите PRO, чтобы вести больше клиентов." },
        { status: 402 },
      );
    }

    const client = await prisma.client.findUniqueOrThrow({ where: { id: result.added[0].id }, include: PHOTO_INCLUDE });
    return NextResponse.json(
      { ...(await withStatsOne(withPhoto(client))), found: Boolean(found), created: result.added[0].created },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
