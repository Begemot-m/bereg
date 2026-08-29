import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { NOT_APPROVED } from "@/lib/server/access";
import { withPhoto, withStatsOne } from "@/lib/server/clients";
import { addContactClients, type TgContact } from "@/lib/server/contacts";
import { env } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const api = (method: string) => `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;

const schema = z.object({
  username: z.string().trim().transform((v) => v.replace(/^@/, "")).pipe(z.string().regex(/^[A-Za-z0-9_]{3,32}$/, "Ник из латиницы, цифр и подчёркиваний")),
});

/**
 * Клиент по нику: специалист пишет @ivanova — карточка заводится сразу, не
 * уходя в чат бота.
 *
 * Имя и аватарку отдаёт `getChat`, но только для тех, кто уже писал боту:
 * произвольный ник Telegram боту не разрешает разрешать. Поэтому промах — не
 * ошибка: карточка всё равно заводится, ником вместо имени, и «Написать» из
 * неё работает. Имя специалист поправит в карточке за секунду.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { username } = await parseBody(req, schema);

    let contact: TgContact = { name: username, username };
    const res = await fetch(api(`getChat?chat_id=${encodeURIComponent(`@${username}`)}`));
    const data = (await res.json()) as {
      ok: boolean;
      result?: { id?: number; first_name?: string; last_name?: string; username?: string; photo?: { small_file_id?: string } };
    };
    if (data.ok && data.result) {
      const chat = data.result;
      contact = {
        userId: chat.id ?? null,
        name: [chat.first_name, chat.last_name].filter(Boolean).join(" ") || username,
        username: chat.username ?? username,
        photoId: chat.photo?.small_file_id ?? null,
      };
    }

    const result = await addContactClients(user.id, [contact]);
    if (!result.approved) return NextResponse.json(NOT_APPROVED, { status: 403 });
    if (result.limited || !result.added[0]) {
      return NextResponse.json({ error: "limit_reached", message: "Места на бесплатном тарифе закончились. Подключите PRO, чтобы вести больше клиентов." }, { status: 402 });
    }

    const client = await prisma.client.findUniqueOrThrow({ where: { id: result.added[0].id } });
    return NextResponse.json(await withStatsOne(withPhoto(client)), { status: result.added[0].created ? 201 : 200 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
