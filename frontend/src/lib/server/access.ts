// Права и лимиты на сервере.
//
// Ровно один источник истины: интерфейс тоже считает лимиты, но это подсказка
// пользователю, а не защита. Любую проверку, от которой зависят деньги,
// повторяем здесь — фронтенд обходится одним curl.

import { prisma } from "@/lib/server/prisma";

/** Бесплатный тариф «Старт»: до трёх активных клиентов. */
export const FREE_CLIENT_LIMIT = 3;

/** Сколько длится пробный период с момента регистрации. */
const TRIAL_DAYS = 10;

export type Access = {
  pro: boolean;
  reason: "trial" | "paid" | "granted" | "none";
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

/**
 * Есть ли у психолога доступ PRO. Три пути: идёт триал, оплачена подписка,
 * либо доступ выдан вручную из админки (тот же `status: active`, но с
 * пометкой `grantedBy`).
 */
export async function access(userId: number): Promise<Access> {
  const [user, sub] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.subscription.findUnique({ where: { psychologistId: userId } }),
  ]);
  if (!user) return { pro: false, reason: "none", trialEndsAt: null, currentPeriodEnd: null };

  const now = Date.now();
  const trialEndsAt = new Date(user.createdAt);
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  const paidActive = sub?.status === "active" && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > now);
  if (paidActive) {
    return {
      pro: true,
      reason: sub?.grantedBy ? "granted" : "paid",
      trialEndsAt: null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    };
  }

  // Триал только пока подписки не было вовсе: иначе истёкшая подписка
  // возвращала бы человека в бесплатный пробный период по кругу.
  const trialActive = !sub && trialEndsAt.getTime() > now;
  return {
    pro: trialActive,
    reason: trialActive ? "trial" : "none",
    trialEndsAt: trialActive ? trialEndsAt : null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  };
}

/**
 * Можно ли завести ещё одного клиента. Считаем всех: удалённые карточки
 * удаляются физически, так что счётчик честный.
 */
export async function canAddClient(userId: number): Promise<{ ok: boolean; used: number; limit: number | null }> {
  const { pro } = await access(userId);
  if (pro) return { ok: true, used: 0, limit: null };

  const used = await prisma.client.count({ where: { psychologistId: userId } });
  return { ok: used < FREE_CLIENT_LIMIT, used, limit: FREE_CLIENT_LIMIT };
}

/**
 * Прошёл ли психолог верификацию. До `approved` анкеты нет в каталоге и брать
 * клиентов нельзя — кабинет при этом открыт целиком, чтобы человек видел,
 * ради чего дозаполняет заявку.
 */
export async function psyApproved(userId: number): Promise<boolean> {
  const psy = await prisma.psyProfile.findUnique({ where: { userId }, select: { status: true } });
  return psy?.status === "approved";
}

export const NOT_APPROVED = {
  error: "not_approved",
  message: "Принимать клиентов можно после подтверждения анкеты. Заявка на верификацию — в кабинете.",
} as const;

/** Администратор платформы. Флаг ставится только вручную в базе. */
export async function isAdmin(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, username: true } });
  return user?.isAdmin === true && user.username?.replace(/^@/, "").toLowerCase() === "mmgorba";
}
