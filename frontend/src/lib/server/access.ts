// Права и лимиты на сервере.
//
// Ровно один источник истины: интерфейс тоже считает лимиты, но это подсказка
// пользователю, а не защита. Любую проверку, от которой зависят деньги,
// повторяем здесь — фронтенд обходится одним curl.

import { prisma } from "@/lib/server/prisma";

/** Бесплатный тариф «Старт»: до трёх активных клиентов. */
export const FREE_CLIENT_LIMIT = 3;

/**
 * Сколько длится пробный PRO. Отсчёт идёт не от регистрации, а от первой
 * проведённой сессии: между регистрацией и первым клиентом стоит модерация
 * анкеты, и триал от `createdAt` сгорал раньше, чем человек успевал увидеть,
 * за что тут платят.
 */
const TRIAL_DAYS = 14;

export type Access = {
  pro: boolean;
  reason: "trial" | "paid" | "granted" | "none";
  /** Когда кончится пробный PRO. `null` — триал не идёт или ещё не начался. */
  trialEndsAt: Date | null;
  /** Была ли первая проведённая сессия, то есть запущен ли отсчёт триала. */
  trialStarted: boolean;
  currentPeriodEnd: Date | null;
  /** Показывать ли анкету в каталоге. Даёт верификация, а не подписка. */
  catalog: boolean;
  /** Приоритетная выдача в каталоге — за неё и платят. */
  priority: boolean;
};

const NO_ACCESS: Access = {
  pro: false,
  reason: "none",
  trialEndsAt: null,
  trialStarted: false,
  currentPeriodEnd: null,
  catalog: false,
  priority: false,
};

/**
 * Момент первой проведённой сессии. Отменённые не считаются: иначе триал
 * запускался бы записью, которой не было.
 */
async function firstSessionAt(userId: number): Promise<Date | null> {
  const first = await prisma.appointment.findFirst({
    where: { psychologistId: userId, status: { not: "cancelled" }, startsAt: { lte: new Date() } },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true },
  });
  return first?.startsAt ?? null;
}

/**
 * Есть ли у психолога доступ PRO. Три пути: идёт триал, оплачена подписка,
 * либо доступ выдан вручную из админки (тот же `status: active`, но с
 * пометкой `grantedBy`). Размещение в каталоге к подписке не привязано: его
 * открывает верификация анкеты и обратно оно не закрывается. PRO поднимает
 * карточку в приоритетную выдачу.
 */
export async function access(userId: number): Promise<Access> {
  const [user, sub, psy] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.subscription.findUnique({ where: { psychologistId: userId } }),
    prisma.psyProfile.findUnique({ where: { userId }, select: { status: true } }),
  ]);
  if (!user) return NO_ACCESS;

  const now = Date.now();

  // Каталог открывает верификация и ничего больше: пустой каталог никому не
  // продать, поэтому размещение бесплатно и бессрочно.
  const catalog = psy?.status === "approved";

  const paidActive = sub?.status === "active" && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > now);
  if (paidActive) {
    return {
      pro: true,
      reason: sub?.grantedBy ? "granted" : "paid",
      trialEndsAt: null,
      trialStarted: true,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      catalog,
      priority: catalog,
    };
  }

  // Триал только пока подписки не было вовсе: иначе истёкшая подписка
  // возвращала бы человека в бесплатный пробный период по кругу.
  const startedAt = sub ? null : await firstSessionAt(userId);
  let trialEndsAt: Date | null = null;
  if (startedAt) {
    trialEndsAt = new Date(startedAt);
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  }
  const trialActive = Boolean(trialEndsAt && trialEndsAt.getTime() > now);

  return {
    pro: trialActive,
    reason: trialActive ? "trial" : "none",
    trialEndsAt: trialActive ? trialEndsAt : null,
    trialStarted: Boolean(startedAt),
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    catalog,
    priority: catalog && trialActive,
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
  // Статус лежит рядом с ролью, чтобы проверка прав не поднимала анкету. Пока
  // идёт переход, у старых записей поле пустое — тогда смотрим в анкету, она
  // и была источником правды.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { psyStatus: true } });
  if (user?.psyStatus && user.psyStatus !== "none") return user.psyStatus === "approved";

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
