import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { decryptText, encryptText } from "@/lib/server/therapy";

export const runtime = "nodejs";

const STATUSES = new Set(["assigned", "doing", "done"]);

/**
 * Задание доступно двоим: психологу, который его выдал, и клиенту, которому
 * оно адресовано. Проверяем обе связи — id из пути сам по себе ничего не даёт.
 */
async function reachable(homeworkId: number, userId: number) {
  const hw = await prisma.homework.findUnique({
    where: { id: homeworkId },
    include: { client: { select: { psychologistId: true, userId: true } } },
  });
  if (!hw) return null;
  const mine = hw.client.psychologistId === userId || hw.client.userId === userId;
  return mine ? hw : null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const hw = await reachable(Number(id), user.id);
    if (!hw) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json()) as { text?: string; status?: string };
    if (body.status !== undefined && !STATUSES.has(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 422 });
    }

    const updated = await prisma.homework.update({
      where: { id: hw.id },
      data: {
        ...(body.text !== undefined ? { text: encryptText(String(body.text).slice(0, 2000)) } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });
    return NextResponse.json({
      id: updated.id,
      clientId: updated.clientId,
      text: decryptText(updated.text),
      status: updated.status,
      sentAt: updated.sentAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const hw = await reachable(Number(id), user.id);
    if (!hw) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Удалять задание может только тот, кто его выдал.
    if (hw.client.psychologistId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.homework.delete({ where: { id: hw.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
