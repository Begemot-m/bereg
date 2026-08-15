import { NextResponse, type NextRequest } from "next/server";

import { PHOTO_INCLUDE, withPhoto, withStatsOne } from "@/lib/server/clients";
import { inviteCode } from "@/lib/server/invite-code";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Достаёт клиента с проверкой владения — защита от IDOR.
async function getOwned(clientId: number, psychologistId: number) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, include: PHOTO_INCLUDE });
  if (!client || client.psychologistId !== psychologistId) return null;
  return client;
}

// Одна карточка. Роута не было вовсе: экраны клиента, его домашек и заметок
// звали /clients/:id и получали 405 — в демо мок это умел, поэтому дыра
// держалась незамеченной.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await getOwned(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Подпись карточки едет вместе с ней: из неё собирается ссылка-приглашение,
    // и она нужна экрану до того, как психолог нажал «Пригласить».
    return NextResponse.json({ ...(await withStatsOne(withPhoto(client))), inviteToken: await inviteCode("card", client.id) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await getOwned(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // status и joinedName интерфейс шлёт с первого дня, а роут их выбрасывал:
    // «Пауза» вручную не ставилась, а предложение заменить имя возвращалось
    // после каждого обновления страницы.
    const body = (await req.json()) as { name?: string; contact?: string; note?: string; status?: string; joinedName?: string | null };
    const status = ["new", "therapy", "paused"].includes(body.status ?? "") ? body.status : undefined;
    const updated = await prisma.client.update({
      where: { id: client.id },
      include: PHOTO_INCLUDE,
      data: {
        name: body.name?.trim() || undefined,
        contact: body.contact === undefined ? undefined : body.contact.trim() || null,
        note: body.note ?? undefined,
        status,
        joinedName: body.joinedName === undefined ? undefined : body.joinedName || null,
      },
    });
    return NextResponse.json(await withStatsOne(withPhoto(updated)));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await getOwned(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Карточки не стало — специалист не должен остаться у человека в «Терапии»
    // закреплённым. Связь помечаем открепленной, а не удаляем: история
    // прикреплений живёт в ней же.
    if (client.userId) {
      await prisma.therapistLink.updateMany({
        where: { clientUserId: client.userId, psychologistId: user.id },
        data: { detached: true, active: false },
      });
    }

    await prisma.client.delete({ where: { id: client.id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
