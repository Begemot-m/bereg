import { NextResponse, type NextRequest } from "next/server";

import { photoSig } from "@/lib/server/clients";
import { env } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Аватарка клиента, заведённого выбором контакта. У Telegram она живёт за
 * `file_id` и открывается только с токеном бота, поэтому файл идёт через нас.
 *
 * Пускает подпись в `?s=`, а не сессия: картинку тянет `<img>`, заголовок
 * авторизации туда не подставить. Подпись считается от номера карточки и
 * `file_id` — сменилась аватарка, старый адрес умер, и ответ можно кешировать
 * навсегда: иначе список клиентов тянул бы её на каждом открытии раздела.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const sig = new URL(req.url).searchParams.get("s") ?? "";
  if (!Number.isFinite(id) || !sig) return new NextResponse(null, { status: 404 });

  const client = await prisma.client.findUnique({ where: { id }, select: { tgPhotoId: true } });
  if (!client?.tgPhotoId || photoSig(id, client.tgPhotoId) !== sig) return new NextResponse(null, { status: 404 });

  const info = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/getFile?file_id=${encodeURIComponent(client.tgPhotoId)}`);
  const data = (await info.json()) as { ok: boolean; result?: { file_path?: string } };
  const path = data.ok ? data.result?.file_path : undefined;
  if (!path) return new NextResponse(null, { status: 404 });

  const file = await fetch(`https://api.telegram.org/file/bot${env.telegramBotToken}/${path}`);
  if (!file.ok || !file.body) return new NextResponse(null, { status: 404 });

  return new NextResponse(file.body, {
    headers: {
      "content-type": file.headers.get("content-type") ?? "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
