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
  // Обложка приходит data-URL'ом: рисует её приложение на canvas, серверу
  // остаётся залить картинку в Telegram и приложить к сообщению.
  photo: z.string().max(8_000_000).optional(),
});

// Подпись под фото у Telegram короче обычного сообщения. Не влезло — уходит
// текстом без картинки: терять список окон ради обложки нельзя.
const CAPTION_MAX = 1024;

const api = (method: string) => `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;

/**
 * Кладёт обложку в Telegram и отдаёт её `file_id`. Готового адреса у картинки
 * нет — она нарисована в браузере, — поэтому файл уходит в личный чат самого
 * специалиста и тут же удаляется: `file_id` после удаления остаётся рабочим,
 * а в переписке ничего не оседает.
 */
async function uploadCover(dataUrl: string, chatId: string): Promise<string | null> {
  const parsed = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!parsed) return null;
  const bytes = Buffer.from(parsed[2], "base64");
  if (!bytes.length || bytes.length > 6_000_000) return null;

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("disable_notification", "true");
  form.append("photo", new Blob([bytes], { type: `image/${parsed[1]}` }), parsed[1] === "png" ? "cover.png" : "cover.jpg");

  const res = await fetch(api("sendPhoto"), { method: "POST", body: form });
  const data = (await res.json()) as { ok: boolean; result?: { message_id: number; photo?: { file_id: string; width: number }[] } };
  const sizes = data.result?.photo ?? [];
  if (!data.ok || !sizes.length) return null;

  void fetch(api("deleteMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: data.result?.message_id }),
  }).catch(() => {});

  return sizes.reduce((best, size) => (size.width > best.width ? size : best)).file_id;
}

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
    const { text, link, button, photo } = await parseBody(req, schema);

    const chatId = String(user.telegramId);
    const keyboard = { inline_keyboard: [[{ text: button, url: link }]] };
    // Обложка — украшение: не залилась, слишком длинный текст под подпись —
    // отправляем то же самое сообщение без картинки.
    const cover = photo && text.length <= CAPTION_MAX ? await uploadCover(photo, chatId).catch(() => null) : null;

    const result = cover
      ? { type: "photo", id: `win${Date.now()}`, photo_file_id: cover, caption: text, reply_markup: keyboard }
      : {
          type: "article",
          id: `win${Date.now()}`,
          title: "Запись на сессию",
          description: "Свободные окна и кнопка записи",
          input_message_content: { message_text: text, link_preview_options: { is_disabled: true } },
          reply_markup: keyboard,
        };

    const res = await fetch(api("savePreparedInlineMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_id: Number(user.telegramId),
        allow_user_chats: true,
        allow_group_chats: true,
        allow_channel_chats: true,
        result,
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
