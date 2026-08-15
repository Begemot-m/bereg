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

/** Сколько анкета стоит в каталоге бесплатно после одобрения. */
export const CATALOG_FREE_DAYS = 14;

/** Что известно о размещении одной анкеты: её статус и подписка владельца. */
export type PlacementInput = {
  status: string | null | undefined;
  reviewedAt: Date | null | undefined;
  subStatus?: string | null;
  currentPeriodEnd?: Date | null;
};

export type Placement = {
  /** Видна ли карточка в каталоге прямо сейчас. */
  placed: boolean;
  /** Докуда бесплатное размещение после одобрения. */
  freeUntil: Date | null;
  reason: "paid" | "free" | "expired" | "not_approved";
};

/**
 * Одно правило размещения на всю платформу: карточка стоит в каталоге, если
 * анкета одобрена и либо оплачен PRO, либо ещё идут бесплатные 14 дней с
 * момента одобрения. По нему живут и `/api/catalog`, и ответ `/subscription`.
 */
export function catalogPlacement(input: PlacementInput, now = Date.now()): Placement {
  if (input.status !== "approved") return { placed: false, freeUntil: null, reason: "not_approved" };

  let freeUntil: Date | null = null;
  if (input.reviewedAt) {
    freeUntil = new Date(input.reviewedAt);
    freeUntil.setDate(freeUntil.getDate() + CATALOG_FREE_DAYS);
  }
  const freeActive = Boolean(freeUntil && freeUntil.getTime() > now);
  const paid = input.subStatus === "active" && (!input.currentPeriodEnd || input.currentPeriodEnd.getTime() > now);

  if (paid) return { placed: true, freeUntil, reason: "paid" };
  if (freeActive) return { placed: true, freeUntil, reason: "free" };
  return { placed: false, freeUntil, reason: "expired" };
}

export type Access = {
  pro: boolean;
  reason: "trial" | "paid" | "granted" | "none";
  /** Когда кончится пробный PRO. `null` — триал не идёт или ещё не начался. */
  trialEndsAt: Date | null;
  /** Была ли первая проведённая сессия, то есть запущен ли отсчёт триала. */
  trialStarted: boolean;
  currentPeriodEnd: Date | null;
  /** До какого момента карточка стоит в каталоге бесплатно. */
  catalogUntil: Date | null;
  /** Показывать ли анкету в каталоге прямо сейчас. */
  catalog: boolean;
};

const NO_ACCESS: Access = {
  pro: false,
  reason: "none",
  trialEndsAt: null,
  trialStarted: false,
  currentPeriodEnd: null,
  catalogUntil: null,
  catalog: false,
};

/**
 * Момент первой проведённой сессии. Отменённые не считаются: иначе триал
 * запускался бы записью, которой не было.
 */
async function firstSessionAt(userId: number): Promise<Date | null> {
  const first = await prisma.appointment.findFirst({
    // Встречи с карточкой-примером триал не запускают: она заведена
    // платформой, и её «история» — рисунок, а не работа.
    where: { psychologistId: userId, status: { not: "cancelled" }, startsAt: { lte: new Date() }, client: { demo: false } },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true },
  });
  return first?.startsAt ?? null;
}

/**
 * Есть ли у психолога доступ PRO. Три пути: идёт триал, оплачена подписка,
 * либо доступ выдан вручную из админки (тот же `status: active`, но с
 * пометкой `grantedBy`). Размещение в каталоге входит в PRO, а до него —
 * первые 14 дней после одобрения анкеты.
 */
export async function access(userId: number): Promise<Access> {
  const [user, sub, psy] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.subscription.findUnique({ where: { psychologistId: userId } }),
    prisma.psyProfile.findUnique({ where: { userId }, select: { status: true, reviewedAt: true } }),
  ]);
  if (!user) return NO_ACCESS;

  const now = Date.now();

  // Бесплатные 14 дней в каталоге идут от одобрения анкеты и не зависят от
  // подписки: пока они не вышли, карточка стоит даже на бесплатном тарифе.
  const placement = catalogPlacement(
    { status: psy?.status, reviewedAt: psy?.reviewedAt, subStatus: sub?.status, currentPeriodEnd: sub?.currentPeriodEnd },
    now,
  );
  const catalogUntil = placement.freeUntil;

  const paidActive = sub?.status === "active" && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > now);
  if (paidActive) {
    return {
      pro: true,
      reason: sub?.grantedBy ? "granted" : "paid",
      trialEndsAt: null,
      trialStarted: true,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      catalogUntil,
      catalog: true,
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
    catalogUntil,
    // Пробный PRO — это тоже PRO: пока он идёт, карточка стоит в каталоге,
    // даже если бесплатные 14 дней после одобрения уже прошли.
    catalog: placement.placed || (trialActive && psy?.status === "approved"),
  };
}

/**
 * Можно ли завести ещё одного клиента. Считаем всех: удалённые карточки
 * удаляются физически, так что счётчик честный.
 */
export async function canAddClient(userId: number): Promise<{ ok: boolean; used: number; limit: number | null }> {
  const { pro } = await access(userId);
  if (pro) return { ok: true, used: 0, limit: null };

  // Карточка-пример места не занимает: она заведена платформой, а не работой.
  const used = await prisma.client.count({ where: { psychologistId: userId, demo: false } });
  return { ok: used < FREE_CLIENT_LIMIT, used, limit: FREE_CLIENT_LIMIT };
}

/** Что видит клиент, когда специалист закрыт: причину не называем — это его дело. */
export const NOT_ACCEPTING = {
  error: "not_accepting",
  message: "Специалист временно не принимает заявки через платформу",
} as const;

export type Accepting = {
  /** Принимает ли специалист новые заявки через платформу. */
  accepting: boolean;
  used: number;
  limit: number | null;
  pro: boolean;
};

/**
 * Приём новых заявок. Закрыт, когда бесплатных мест не осталось: платформа
 * перестаёт приводить людей, которых специалисту некуда взять, — и молчит о
 * причине, потому что тариф психолога клиента не касается.
 *
 * Уже заведённые карточки продолжают работать: отбирать текущих клиентов за
 * кончившуюся подписку нельзя. Психолог по-прежнему записывает своих сам —
 * закрыт только вход снаружи: каталог, прикрепление и самозапись клиента.
 */
export async function acceptingNewClients(userId: number): Promise<Accepting> {
  const { pro } = await access(userId);
  // Карточка-пример места не занимает: она заведена платформой, а не работой.
  const used = await prisma.client.count({ where: { psychologistId: userId, demo: false } });
  return { accepting: hasFreeSeat(pro, used), used, limit: pro ? null : FREE_CLIENT_LIMIT, pro };
}

/** Само правило, без базы: у PRO мест сколько угодно, на бесплатном — три. */
export const hasFreeSeat = (pro: boolean, used: number) => pro || used < FREE_CLIENT_LIMIT;

/**
 * Сказать психологу, что заявка не дошла из-за лимита. Не чаще раза в сутки:
 * человек и так это знает из раздела «Клиенты», а колокольчик, звонящий на
 * каждый отказ, читать перестают.
 */
export async function notifyLimitReached(psychologistId: number) {
  const since = new Date(Date.now() - 86_400_000);
  // Ищем по началу текста, а не по своему виду уведомления: интерфейс рисует
  // иконку по известным kind, и новый вид пришлось бы учить всюду.
  const head = "Заняты все бесплатные карточки";
  const recent = await prisma.notification.findFirst({
    where: { userId: psychologistId, text: { startsWith: head }, createdAt: { gte: since } },
    select: { id: true },
  });
  if (recent) return;
  await prisma.notification.create({
    data: {
      userId: psychologistId,
      kind: "system",
      text: `${head} (${FREE_CLIENT_LIMIT}) — новые клиенты сейчас не могут к вам записаться, а анкета скрыта из каталога. Подписка снимает лимит и возвращает вас в выдачу.`,
    },
  });
}

/** Те же данные пачкой — каталогу нужно решение сразу по десяткам анкет. */
export async function acceptingByIds(ids: number[], proIds: Set<number>): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const counts = await prisma.client.groupBy({
    by: ["psychologistId"],
    where: { psychologistId: { in: ids } },
    _count: { _all: true },
  });
  const usedOf = new Map(counts.map((row) => [row.psychologistId as number, row._count._all]));
  return new Set(ids.filter((id) => hasFreeSeat(proIds.has(id), usedOf.get(id) ?? 0)));
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

/**
 * Может ли клиент работать с этим специалистом: записаться, закрепить, увидеть
 * расписание. Одобренная анкета открыта всем, но человека, которого психолог
 * позвал сам, верификация задерживать не должна — анкету по прямой ссылке он
 * уже видит, а прикрепиться и записаться не мог.
 */
export async function canWorkWithPsy(clientUserId: number, psychologistId: number): Promise<boolean> {
  const psy = await prisma.psyProfile.findUnique({ where: { userId: psychologistId }, select: { status: true } });
  if (!psy) return false;
  if (psy.status === "approved") return true;

  const [card, link] = await Promise.all([
    prisma.client.findFirst({ where: { userId: clientUserId, psychologistId }, select: { id: true } }),
    prisma.therapistLink.findUnique({
      where: { clientUserId_psychologistId: { clientUserId, psychologistId } },
      select: { detached: true },
    }),
  ]);
  return Boolean(card) || Boolean(link && !link.detached);
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
