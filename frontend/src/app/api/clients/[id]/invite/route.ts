import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { ownedClient } from "@/lib/server/therapy";

export const runtime = "nodejs";

// Психолог зовёт клиента подключить свой профиль. Сама ссылка формируется на
// клиенте; здесь только фиксируем состояние — чтобы карточка показывала
// «ждём подключения», а не гадала по наличию контакта.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await ownedClient(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { contact?: string };
    const updated = await prisma.client.update({
      where: { id: client.id },
      data: {
        ...(body.contact !== undefined ? { contact: body.contact || null } : {}),
        link: "invited",
        invitedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
