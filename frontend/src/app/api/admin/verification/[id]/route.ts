import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { audit } from "@/lib/server/audit";
import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

// Отказ без причины — тупик: человек не понимает, что переделать, и уходит.
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(5).max(500) }),
]);

/**
 * Решение по анкете психолога. Одобрение открывает каталог и приём клиентов,
 * поэтому пишется в аудит и сообщается человеку уведомлением: он ждёт ответа
 * и не должен узнавать о нём, случайно заглянув в кабинет.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const profile = await prisma.psyProfile.findUnique({ where: { userId } });
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await parseBody(req, patchSchema);
    const approve = body.action === "approve";

    await prisma.psyProfile.update({
      where: { userId },
      data: {
        status: approve ? "approved" : "rejected",
        rejectReason: approve ? null : body.reason,
        reviewedAt: new Date(),
      },
    });

    // Роль могли не переключить, если анкету заводили не через кабинет.
    if (approve) {
      await prisma.user.updateMany({
        where: { id: userId, role: { not: "psychologist" } },
        data: { role: "psychologist" },
      });
    }

    await prisma.notification.create({
      data: {
        userId,
        kind: "system",
        text: approve
          ? "Практика подтверждена. Ваша анкета опубликована в каталоге, можно приглашать клиентов."
          : `Анкета вернулась на доработку: ${body.reason}`,
      },
    });

    await audit(req, {
      userId: admin.id,
      action: approve ? "admin.psy.approve" : "admin.psy.reject",
      entity: "PsyProfile",
      entityId: String(userId),
      meta: approve ? {} : { reason: body.reason },
    });

    return NextResponse.json({ userId, status: approve ? "approved" : "rejected" });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
