import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/server/env";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const api = (method: string) => `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;

/**
 * Нативный выбор контактов. Внутри мини-приложения его не сделать: читать
 * список контактов Telegram приложениям не даёт — единственный способ выбрать
 * человека руками и получить его имя, ник и аватарку — кнопка `request_users`
 * в чате бота (Bot API 7.2). Поэтому роут кладёт специалисту в чат сообщение
 * с этой кнопкой, а приложение открывает чат.
 *
 * Клавиатура одноразовая: выбрал — и она убралась, чат бота остаётся чистым.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const res = await fetch(api("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: String(user.telegramId),
        text: "Выберите людей из своих контактов — заведу на каждого карточку клиента.\n\nПодключать профиль им не нужно: карточка появится с именем и аватаркой, а пригласить к синхронизации можно позже из самой карточки.",
        reply_markup: {
          keyboard: [[{
            text: "Выбрать из контактов",
            request_users: { request_id: 1, user_is_bot: false, max_quantity: 10, request_name: true, request_username: true, request_photo: true },
          }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) return NextResponse.json({ error: "telegram", message: data.description ?? "" }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
