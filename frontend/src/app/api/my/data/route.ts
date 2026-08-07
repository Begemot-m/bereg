import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { deleteStoredFile } from "@/lib/server/files";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Обнуление своих сведений (ст. 14 152-ФЗ).
 *
 * Пришло на смену удалению аккаунта: то гасило доступ и запирало человека
 * снаружи навсегда, хотя просил он не этого. Здесь стирается то, что человек
 * рассказал о себе, а сам вход остаётся — сессии живы, зайти можно сразу.
 *
 * Что НЕ трогаем сознательно:
 * - карточки клиентов психолога и их содержимое — это данные других людей,
 *   их нельзя стереть одной кнопкой из своего кабинета;
 * - записи на приём — они принадлежат обеим сторонам, психологу нужна история;
 * - подписку и платежи — это финансовые документы, а не сведения о себе.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);

    // Личное живёт на карточке, которой человек является как клиент.
    const cards = await prisma.client.findMany({ where: { userId: user.id }, select: { id: true } });
    const cardIds = cards.map((c) => c.id);
    const where = { clientId: { in: cardIds } };

    // Дипломы лежат файлами на диске: строку в базе снесёт транзакция ниже, а
    // сам файл — только этот проход. Забыть его — значит оставить ПД на
    // сервере после того, как человек попросил всё стереть.
    const docs = await prisma.psyDocument.findMany({ where: { userId: user.id }, select: { storageKey: true } });
    for (const doc of docs) await deleteStoredFile(doc.storageKey);

    await prisma.$transaction([
      prisma.psyDocument.deleteMany({ where: { userId: user.id } }),
      prisma.mood.deleteMany({ where }),
      prisma.goodNote.deleteMany({ where }),
      prisma.therapyProfile.deleteMany({ where }),
      prisma.homework.deleteMany({ where }),
      prisma.sessionReflection.deleteMany({ where }),

      // Анкета специалиста — тоже рассказ о себе. Вместе с ней уходит
      // подтверждение практики: заново оно даётся только через модерацию.
      prisma.psyProfile.deleteMany({ where: { userId: user.id } }),

      prisma.user.update({
        where: { id: user.id },
        data: { email: null, emailVerifiedAt: null },
      }),

      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "my.data.wipe",
          entity: "User",
          entityId: String(user.id),
          ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        },
      }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
