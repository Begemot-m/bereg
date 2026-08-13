import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { isAdmin } from "@/lib/server/access";
import { clientIp } from "@/lib/server/client-ip";
import { prisma } from "@/lib/server/prisma";
import { grantPsychologist, hasRole, revokePsychologist, setPsyStatus } from "@/lib/server/roles";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

// Выдать или снять PRO вручную, заблокировать. Верхняя граница — сто лет:
// это и есть «навсегда», но с датой, которую видно в карточке и в аудите.
const FOREVER_DAYS = 36_500;

const patchSchema = z.object({
  grantPro: z.object({ days: z.coerce.number().int().min(1).max(FOREVER_DAYS), note: z.string().max(200).optional() }).optional(),
  revokePro: z.boolean().optional(),
  blocked: z.boolean().optional(),
  role: z.enum(["client", "psychologist"]).optional(),
});

/**
 * Управление пользователем. Всё, что здесь происходит, попадает в аудит:
 * ручная выдача доступа — это решение, за которое кто-то отвечает.
 *
 * Админку админом отсюда сделать нельзя намеренно: флаг ставится только
 * в базе. Иначе одна ошибка в правах раздаёт полный доступ.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireUser(req);
    if (!(await isAdmin(admin.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    const userId = Number(id);
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await parseBody(req, patchSchema);
    const ip = clientIp(req);

    if (body.grantPro) {
      const days = Math.min(FOREVER_DAYS, Math.max(1, Math.round(Number(body.grantPro.days) || 30)));
      const until = new Date();
      until.setDate(until.getDate() + days);

      await prisma.subscription.upsert({
        where: { psychologistId: userId },
        create: {
          psychologistId: userId,
          plan: "pro",
          status: "active",
          currentPeriodEnd: until,
          grantedBy: admin.id,
          grantedNote: body.grantPro.note?.slice(0, 200) ?? null,
        },
        update: {
          plan: "pro",
          status: "active",
          currentPeriodEnd: until,
          grantedBy: admin.id,
          grantedNote: body.grantPro.note?.slice(0, 200) ?? null,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: admin.id, action: "admin.grant_pro", entity: "Subscription", entityId: String(userId), ip,
          meta: { days, until: until.toISOString(), note: body.grantPro.note ?? null },
        },
      });
    }

    if (body.revokePro) {
      // Не удаляем подписку: история платежей и выдач должна остаться.
      await prisma.subscription.updateMany({
        where: { psychologistId: userId },
        data: { status: "inactive", currentPeriodEnd: new Date() },
      });
      await prisma.auditLog.create({
        data: { userId: admin.id, action: "admin.revoke_pro", entity: "Subscription", entityId: String(userId), ip },
      });
    }

    const targetIsPsy = hasRole(target, "psychologist");
    if (body.role && (body.role === "psychologist") !== targetIsPsy) {
      if (body.role === "psychologist") await grantPsychologist(userId);
      else await revokePsychologist(userId);

      // Каталог смотрит на анкету, а не на роль: оставить одобренную анкету
      // у бывшего психолога — значит держать в каталоге человека, который
      // больше не принимает. Снимаем с публикации, текст анкеты остаётся.
      const unpublished = body.role === "client"
        ? (await prisma.psyProfile.updateMany({
            where: { userId, status: "approved" },
            data: { status: "draft", reviewedAt: null },
          })).count > 0
        : false;
      if (unpublished) await setPsyStatus(userId, "draft");

      await prisma.notification.create({
        data: {
          userId,
          kind: "system",
          text: body.role === "psychologist"
            ? "Ваша роль изменена на «психолог». Чтобы попасть в каталог, отправьте анкету на проверку."
            : "Ваша роль изменена на «клиент». Анкета снята с публикации в каталоге.",
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: admin.id, action: "admin.role.change", entity: "User", entityId: String(userId), ip,
          meta: { from: targetIsPsy ? "psychologist" : "client", to: body.role, unpublished },
        },
      });
    }

    if (body.blocked !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { blockedAt: body.blocked ? new Date() : null },
      });
      // Блокировка без выхода из сессий — половина блокировки.
      if (body.blocked) await prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
      await prisma.auditLog.create({
        data: { userId: admin.id, action: body.blocked ? "admin.block" : "admin.unblock", entity: "User", entityId: String(userId), ip },
      });
    }

    const fresh = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    return NextResponse.json(fresh);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
