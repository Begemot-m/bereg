import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { z } from "zod";

import { decryptText, encryptText, ownedClient } from "@/lib/server/therapy";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const toDTO = (h: { id: number; clientId: number; text: string; status: string; sentAt: Date }) => ({
  id: h.id,
  clientId: h.clientId,
  text: decryptText(h.text),
  status: h.status,
  sentAt: h.sentAt.toISOString(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await ownedClient(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const list = await prisma.homework.findMany({ where: { clientId: client.id }, orderBy: { sentAt: "desc" } });
    return NextResponse.json(list.map(toDTO));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await ownedClient(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const body = await parseBody(req, z.object({ text: z.string().trim().min(1, "Текст задания пуст").max(2000) }));

    const created = await prisma.homework.create({
      data: { clientId: client.id, text: encryptText(body.text) },
    });
    return NextResponse.json(toDTO(created), { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
