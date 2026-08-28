import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { AuthError, requireUser } from "@/lib/server/session";
import { env } from "@/lib/server/env";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

const schema = z.object({
  text: z.string().trim().min(1).max(3500),
  link: z.string().trim().url().max(500),
  button: z.string().trim().min(1).max(60).default("Записаться на сессию"),
});

/**
 * Готовит сообщение с настоящей кнопкой, которое специалист отправит из
 * приложения в любой чат (`Telegram.WebApp.shareMessage`).
 *
 * Ссылкой это не решается: ссылку получатель должен заметить, нажать и попасть
 * в чат бота. Prepared-сообщение уходит от имени специалиста с кнопкой под
 * текстом — один тап, и человек уже в приложении на нужном экране.
 *
 * Сообщение живёт на стороне Telegram около получаса, поэтому готовим его в
 * момент отправки, а не заранее.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { text, link, button } = await parseBody(req, schema);

    const res = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/savePreparedInlineMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_id: Number(user.telegramId),
        allow_user_chats: true,
        allow_group_chats: true,
        allow_channel_chats: true,
        result: {
          type: "article",
          id: `win${Date.now()}`,
          title: "Запись на сессию",
          description: "Свободные окна и кнопка записи",
          input_message_content: { message_text: text, link_preview_options: { is_disabled: true } },
          reply_markup: { inline_keyboard: [[{ text: button, url: link }]] },
        },
      }),
    });

    const data = (await res.json()) as { ok: boolean; result?: { id: string }; description?: string };
    if (!data.ok || !data.result) {
      // Старый клиент Telegram или бот без inline-режима: приложению это знать
      // достаточно, оно отправит приглашение ссылкой, как раньше.
      return NextResponse.json({ error: data.description ?? "prepare failed" }, { status: 502 });
    }
    return NextResponse.json({ id: data.result.id });
  } catch (e) {
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
