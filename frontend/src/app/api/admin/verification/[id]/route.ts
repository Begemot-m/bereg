import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { CATALOG_DECLINE_TEXT } from "@/lib/pricing";
import { audit } from "@/lib/server/audit";
import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { queueNudge } from "@/lib/server/nudges";
import { grantPsychologist, setPsyStatus } from "@/lib/server/roles";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

// Отказ без причины — тупик: человек не понимает, что переделать, и уходит.
// decline — третий исход: в каталог не берём совсем, но платформа остаётся, и
// причину тут писать не обязательно — формулировка у отказа одна.
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("decline"), reason: z.string().trim().max(500).optional() }),
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
    const decline = body.action === "decline";
    const status = approve ? "approved" : decline ? "declined" : "rejected";
    const reason = decline ? (body.reason?.trim() || CATALOG_DECLINE_TEXT) : approve ? null : body.reason;

    await prisma.psyProfile.update({
      where: { userId },
      data: { status, rejectReason: reason, reviewedAt: new Date() },
    });

    // Роль могли не переключить, если анкету заводили не через кабинет. При
    // отказе по каталогу роль тем более нужна: своих клиентов человек ведёт
    // дальше, просто без места в общей выдаче.
    if (approve || decline) await grantPsychologist(userId);
    // Статус живёт и рядом с ролью: права читают его оттуда, не поднимая анкету.
    await setPsyStatus(userId, status);

    await prisma.notification.create({
      data: {
        userId,
        kind: "system",
        text: approve
          ? "Практика подтверждена. Ваша анкета опубликована в каталоге, можно приглашать клиентов."
          : decline
            ? reason ?? CATALOG_DECLINE_TEXT
            : `Анкета вернулась на доработку: ${body.reason}`,
      },
    });

    // Уведомление в кабинете человек увидит, только если сам зайдёт. Одобрение
    // он ждёт — поэтому о нём пишет и бот. Очередь защищена ключом «получатель +
    // вид + период», так что повторное одобрение приветствие не продублирует.
    if (approve) await queueNudge(prisma, { recipientId: userId, kind: "verified" });

    await audit(req, {
      userId: admin.id,
      action: approve ? "admin.psy.approve" : decline ? "admin.psy.decline" : "admin.psy.reject",
      entity: "PsyProfile",
      entityId: String(userId),
      meta: approve ? {} : { reason },
    });

    return NextResponse.json({ userId, status });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
