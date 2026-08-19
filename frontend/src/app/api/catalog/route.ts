import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import { activityRank, catalogPlacement } from "@/lib/server/access";
import { buildPsyCards, psyProfileRows } from "@/lib/server/psy-card";
import { LIMITS, limited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";


// Каталог открыт без входа: человек должен увидеть специалистов до регистрации.
// Отдаём только опубликованные анкеты и только публичные поля — точный адрес
// и контакты сюда не попадают, они открываются после подтверждённой записи.
export async function GET(req: NextRequest) {
  // Данные тут и так публичные, но выкачивать каталог целиком скриптом ни к
  // чему: живому человеку хватает с запасом.
  const stop = limited(req, "catalog", LIMITS.public);
  if (stop) return stop;

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const maxPrice = Number(url.searchParams.get("maxPrice") ?? 0);

  // ?id=<userId> — одна анкета для ссылки-приглашения. Ни размещение, ни
  // верификация тут не нужны: клиент, которого психолог позвал сам, должен
  // видеть заполненную анкету до модерации. В общую выдачу такая карточка
  // по-прежнему не попадает, и галочки «подтверждён» на ней нет.
  const one = Number(url.searchParams.get("id"));

  // Фотографии из анкет сюда не поднимаем: они лежат data-URL'ом в Json, и
  // каталог вытягивал бы из базы сотни мегабайт base64 ради списка. Карточка
  // отдаёт вместо снимков ссылки на /api/catalog/photo.
  const where =
    one > 0
      ? Prisma.sql`"userId" = ${one}`
      : Prisma.sql`"status" = 'approved'${
          format && format !== "any" ? Prisma.sql` AND ("format" = ${format} OR "format" = 'both')` : Prisma.empty
        }${maxPrice > 0 ? Prisma.sql` AND "sessionPrice" <= ${maxPrice}` : Prisma.empty}`;
  const found = await psyProfileRows(where, one > 0 ? 1 : 200);

  // Размещение бесплатное: анкета стоит в каталоге у всех, кого одобрили.
  // Подписка не добавляет ни места в выдаче, ни строчки выше — иначе
  // специалист, которого не видно, никогда не узнает, приводит ли платформа
  // людей, и платить ему не за что.
  const rows = one > 0 ? found : found.filter((row) => catalogPlacement({ status: row.status, reviewedAt: row.reviewedAt }).placed);
  const ids = rows.map((row) => row.userId);

  // Порядок решает живость, а не деньги: выше тот, кто чаще заходит и, значит,
  // ответит на запись. При равной активности остаётся прежний порядок по цене.
  if (one <= 0) {
    const rank = await activityRank(ids);
    const scoreOf = (id: number) => rank.get(id) ?? { hits: 0, last: 0 };
    rows.sort((a, b) => {
      const x = scoreOf(a.userId);
      const y = scoreOf(b.userId);
      return y.hits - x.hits || y.last - x.last || a.sessionPrice - b.sessionPrice;
    });
  }

  // Карточку собирает общий сборщик (`lib/server/psy-card`): раздел «Терапия»
  // отдаёт ровно те же поля, иначе закреплённый специалист выглядит не так,
  // как та же карточка в каталоге. Записаться можно к каждому, кто в выдаче:
  // упереться человек может только в занятое окно, а не в чужой тариф.
  const cards = await buildPsyCards(rows);
  return NextResponse.json(cards.map((card) => ({ ...card, accepting: true })));
}
