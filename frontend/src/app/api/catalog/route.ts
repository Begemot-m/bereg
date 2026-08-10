import { NextResponse, type NextRequest } from "next/server";

import { catalogPlacement } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { buildPsyCards } from "@/lib/server/psy-card";

export const runtime = "nodejs";


// Каталог открыт без входа: человек должен увидеть специалистов до регистрации.
// Отдаём только опубликованные анкеты и только публичные поля — точный адрес
// и контакты сюда не попадают, они открываются после подтверждённой записи.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const maxPrice = Number(url.searchParams.get("maxPrice") ?? 0);

  // ?id=<userId> — одна анкета для ссылки-приглашения. Ни размещение, ни
  // верификация тут не нужны: клиент, которого психолог позвал сам, должен
  // видеть заполненную анкету до модерации. В общую выдачу такая карточка
  // по-прежнему не попадает, и галочки «подтверждён» на ней нет.
  const one = Number(url.searchParams.get("id"));

  const found = await prisma.psyProfile.findMany({
    where: one > 0
      ? { userId: one }
      : {
          status: "approved",
          ...(format && format !== "any" ? { OR: [{ format }, { format: "both" }] } : {}),
          ...(maxPrice > 0 ? { sessionPrice: { lte: maxPrice } } : {}),
        },
    orderBy: { sessionPrice: "asc" },
    take: one > 0 ? 1 : 200,
  });

  // Одобренной анкеты мало: место в каталоге держат либо оплаченный PRO, либо
  // бесплатные 14 дней после одобрения. Кончилось и то и другое — карточка
  // уходит из выдачи, хотя сама анкета остаётся подтверждённой.
  // По прямой ссылке (?id=) карточка открывается и без размещения: человек
  // пришёл к конкретному специалисту, а не искал его в каталоге.
  const subs = await prisma.subscription.findMany({
    where: { psychologistId: { in: found.map((row) => row.userId) } },
    select: { psychologistId: true, status: true, currentPeriodEnd: true },
  });
  const subOf = new Map(subs.map((row) => [row.psychologistId, row]));
  const rows = one > 0
    ? found
    : found.filter((row) => {
        const sub = subOf.get(row.userId);
        return catalogPlacement({
          status: row.status,
          reviewedAt: row.reviewedAt,
          subStatus: sub?.status,
          currentPeriodEnd: sub?.currentPeriodEnd,
        }).placed;
      });

  // Карточку собирает общий сборщик (`lib/server/psy-card`): раздел «Терапия»
  // отдаёт ровно те же поля, иначе закреплённый специалист выглядит не так,
  // как та же карточка в каталоге.
  return NextResponse.json(await buildPsyCards(rows));
}
