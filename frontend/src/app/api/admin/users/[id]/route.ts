import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

type Body = {
  /** Выдать или снять PRO вручную. Дни: сколько продлить от сегодня. */
  grantPro?: { days: number; note?: string };
  revokePro?: boolean;
  blocked?: boolean;
};

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

    const body = (await req.json()) as Body;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    if (body.grantPro) {
      const days = Math.min(365, Math.max(1, Math.round(Number(body.grantPro.days) || 30)));
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
    throw e;
  }
}
