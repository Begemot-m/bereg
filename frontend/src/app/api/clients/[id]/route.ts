import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Достаёт клиента с проверкой владения — защита от IDOR.
async function getOwned(clientId: number, psychologistId: number) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.psychologistId !== psychologistId) return null;
  return client;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await getOwned(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json()) as { name?: string; contact?: string; note?: string };
    const updated = await prisma.client.update({
      where: { id: client.id },
      data: {
        name: body.name?.trim() || undefined,
        contact: body.contact === undefined ? undefined : body.contact.trim() || null,
        note: body.note ?? undefined,
      },
    });
    return NextResponse.json(updated);
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

    await prisma.client.delete({ where: { id: client.id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
