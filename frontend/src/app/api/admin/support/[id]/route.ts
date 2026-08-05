import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { audit } from "@/lib/server/audit";
import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("handle"), reply: z.string().trim().min(1).max(2000).optional() }),
  z.object({ action: z.literal("reopen") }),
]);

/**
 * Разбор обращения. Ответ уходит уведомлением, если человек вошёл под своим
 * аккаунтом; гостю писать некуда — у него только контакт, и отвечает владелец
 * руками. Само обращение не трогаем: текст жалобы — единственное свидетельство.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    const requestId = Number(id);
    if (!Number.isInteger(requestId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const existing = await prisma.supportRequest.findUnique({ where: { id: requestId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await parseBody(req, patchSchema);
    const handle = body.action === "handle";

    await prisma.supportRequest.update({
      where: { id: requestId },
      data: { handledAt: handle ? new Date() : null },
    });

    const reply = handle ? body.reply : undefined;
    if (reply && existing.userId) {
      await prisma.notification.create({
        data: { userId: existing.userId, kind: "system", text: `Ответ поддержки: ${reply}` },
      });
    }

    await audit(req, {
      userId: admin.id,
      action: handle ? "admin.support.handle" : "admin.support.reopen",
      entity: "SupportRequest",
      entityId: String(requestId),
      meta: { replied: Boolean(reply && existing.userId) },
    });

    return NextResponse.json({ id: requestId, handled: handle });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
