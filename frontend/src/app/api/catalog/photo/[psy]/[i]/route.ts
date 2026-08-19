import { createHash } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

/// Больше трёх снимков анкета не хранит — карточка показывает ровно их.
const MAX_INDEX = 2;
const YEAR = 60 * 60 * 24 * 365;

/**
 * Фотография анкеты отдельным файлом. Сам снимок лежит data-URL'ом в Json
 * профиля, и пока каталог отдавал его прямо в списке, телефон тянул до
 * мегабайта на карточку: кеша у такой картинки нет, отложить её загрузку
 * нельзя, ужать под плашку 106×132 — тоже. Теперь список отдаёт ссылку сюда.
 *
 * Адрес несёт версию анкеты (`?v=`), поэтому содержимое по нему не меняется:
 * поменял психолог фото — поменялся и адрес. Отсюда вечный `immutable`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ psy: string; i: string }> }) {
  const { psy, i } = await params;
  const userId = Number(psy);
  const index = Number(i);
  const missing = NextResponse.json({ error: "not found" }, { status: 404 });
  if (!Number.isInteger(userId) || userId <= 0) return missing;
  if (!Number.isInteger(index) || index < 0 || index > MAX_INDEX) return missing;

  // Поднимаем из базы один снимок, а не анкету целиком: рядом в Json лежат ещё
  // два таких же, и обычный findUnique вытащил бы их следом.
  const rows = await prisma.$queryRaw<{ photo: string | null }[]>`
    SELECT "data"->'photos'->>${index}::int AS photo FROM "PsyProfile" WHERE "userId" = ${userId}
  `;
  const photo = rows[0]?.photo;
  if (!photo) return missing;
  // Анкеты, где фото уже лежит ссылкой, отправляем по ней.
  if (!photo.startsWith("data:")) return NextResponse.redirect(new URL(photo, req.url), 302);

  const parsed = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/s.exec(photo);
  if (!parsed) return missing;
  const [, mime, base64] = parsed;
  // Тип берём из анкеты, поэтому проверяем: всё, кроме картинки, браузер может
  // исполнить на нашем домене.
  if (!mime.startsWith("image/")) return missing;

  const etag = `"${createHash("sha1").update(base64).digest("base64url")}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { etag, "cache-control": `public, max-age=${YEAR}, immutable` } });
  }

  const bytes = Buffer.from(base64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": mime,
      "content-length": String(bytes.length),
      "cache-control": `public, max-age=${YEAR}, immutable`,
      etag,
      "x-content-type-options": "nosniff",
    },
  });
}
