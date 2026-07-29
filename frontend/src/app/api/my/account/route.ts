import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Право на удаление (ст. 14 152-ФЗ).
 *
 * Делаем в два такта, а не одним `delete`:
 *
 * 1. Сразу гасим доступ и стираем то, что принадлежит лично человеку —
 *    дневник, записи «что хорошего», доску, колесо, привязку почты.
 *    Живые сессии убиваем, чтобы открытые вкладки не продолжали работать.
 * 2. Ставим `deletedAt`. Физическую очистку остального доделывает фоновое
 *    задание — так удаление не блокирует запрос на минуту и переживает обрыв.
 *
 * Записи на приём не стираем, а обезличиваем: психологу нужна история встреч
 * и статистика, а без имени и контакта это уже не персональные данные.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const cards = await prisma.client.findMany({ where: { userId: user.id }, select: { id: true } });
    const cardIds = cards.map((c) => c.id);

    await prisma.$transaction([
      // Личное — сразу и полностью.
      prisma.mood.deleteMany({ where: { clientId: { in: cardIds } } }),
      prisma.goodNote.deleteMany({ where: { clientId: { in: cardIds } } }),
      prisma.therapyProfile.deleteMany({ where: { clientId: { in: cardIds } } }),

      // Карточка остаётся у психолога, но обезличивается и отвязывается.
      prisma.client.updateMany({
        where: { id: { in: cardIds } },
        data: { userId: null, link: "none", name: "Удалённый аккаунт", contact: null, note: "" },
      }),

      // Доступ гасим немедленно.
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date(), email: null, emailVerifiedAt: null, username: null, firstName: null },
      }),

      // Запись в журнал: сам факт удаления хранится дольше данных.
      prisma.auditLog.create({
        data: { userId: user.id, action: "delete", entity: "User", entityId: String(user.id), ip },
      }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
