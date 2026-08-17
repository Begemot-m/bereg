// Права и лимиты на сервере.
//
// Ровно один источник истины: интерфейс тоже считает лимиты, но это подсказка
// пользователю, а не защита. Любую проверку, от которой зависят деньги,
// повторяем здесь — фронтенд обходится одним curl.

import { prisma } from "@/lib/server/prisma";

/** Бесплатный тариф «Старт»: до трёх активных клиентов. */
export const FREE_CLIENT_LIMIT = 3;

/**
 * Пробный PRO — единственный на всю платформу. Даётся каждому сразу после
 * верификации анкеты и отсчитывается от `reviewedAt`: до одобрения человеку
 * нечего переносить, а от `createdAt` триал сгорал прямо в очереди модерации.
 * У тех, кто прошёл верификацию раньше, счётчик идёт с их собственного дня, а
 * не запускается заново.
 */
export const TRIAL_DAYS = 14;

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
  /** Докуда идёт пробный PRO после одобрения. */
  freeUntil: Date | null;
  reason: "paid" | "free" | "not_approved";
};

/**
 * Одно правило размещения на всю платформу: карточка стоит в каталоге у всех,
 * чью анкету одобрили. Подписка на это не влияет — специалист, которого не
 * видно, не приведёт клиента и никогда не узнает, работает ли канал вообще.
 * Платформа берёт деньги не за место в списке, а за подтверждение записи и за
 * клиентов сверх бесплатных трёх. Порядок в выдаче тоже не покупается: выше
 * стоят те, кто чаще заходит (`activityRank`).
 */
export function catalogPlacement(input: PlacementInput, now = Date.now()): Placement {
  if (input.status !== "approved") return { placed: false, freeUntil: null, reason: "not_approved" };

  let freeUntil: Date | null = null;
  if (input.reviewedAt) {
    freeUntil = new Date(input.reviewedAt);
    freeUntil.setDate(freeUntil.getDate() + TRIAL_DAYS);
  }
  const paid = input.subStatus === "active" && (!input.currentPeriodEnd || input.currentPeriodEnd.getTime() > now);

  return { placed: true, freeUntil, reason: paid ? "paid" : "free" };
}

export type Access = {
  pro: boolean;
  reason: "trial" | "paid" | "granted" | "none";
  /** Когда кончится пробный PRO. `null` — триал не идёт или ещё не начался. */
  trialEndsAt: Date | null;
  /** Прошла ли верификация, то есть запущен ли отсчёт пробных дней. */
  trialStarted: boolean;
  currentPeriodEnd: Date | null;
  /** До какого момента идёт пробный PRO после одобрения анкеты. */
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

/** Конец пробного периода: дата старта плюс столько-то дней, или `null`. */
function endOfTrial(startedAt: Date | null | undefined, days: number): Date | null {
  if (!startedAt) return null;
  const end = new Date(startedAt);
  end.setDate(end.getDate() + days);
  return end;
}

/**
 * Есть ли у психолога доступ PRO. Пути: идут пробные 14 дней после
 * верификации, оплачена подписка, либо доступ выдан вручную из админки (тот же
 * `status: active`, но с пометкой `grantedBy`). Размещение в каталоге в PRO не
 * входит — оно бесплатное у всех одобренных.
 */
export async function access(userId: number): Promise<Access> {
  const [user, sub, psy] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.subscription.findUnique({ where: { psychologistId: userId } }),
    prisma.psyProfile.findUnique({ where: { userId }, select: { status: true, reviewedAt: true } }),
  ]);
  if (!user) return NO_ACCESS;

  const now = Date.now();

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

  // Триал привязан к дате одобрения анкеты, а не к «была ли подписка»:
  // истёкшая оплата не возвращает человека в пробный период по кругу — те дни
  // к тому моменту давно прошли сами.
  const afterVerify = psy?.status === "approved" ? endOfTrial(psy.reviewedAt, TRIAL_DAYS) : null;
  const trialActive = Boolean(afterVerify && afterVerify.getTime() > now);

  return {
    pro: trialActive,
    reason: trialActive ? "trial" : "none",
    trialEndsAt: trialActive ? afterVerify : null,
    trialStarted: Boolean(afterVerify),
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    catalogUntil,
    catalog: placement.placed,
  };
}

/**
 * Можно ли завести ещё одного клиента. Считаем всех: удалённые карточки
 * удаляются физически, так что счётчик честный.
 */
export async function canAddClient(userId: number): Promise<{ ok: boolean; used: number; limit: number | null }> {
  const { pro } = await access(userId);
  if (pro) return { ok: true, used: 0, limit: null };

  const used = await countSeats(userId);
  return { ok: used < FREE_CLIENT_LIMIT, used, limit: FREE_CLIENT_LIMIT };
}

/**
 * Сколько бесплатных мест занято. Карточка-пример не в счёт — она заведена
 * платформой, а не работой. Заявка из каталога, которую ещё не подтвердили,
 * тоже не в счёт (`pending`): человек постучался, но в практику не попал, и
 * место за ним держать не за что.
 */
export function countSeats(userId: number): Promise<number> {
  return prisma.client.count({ where: { psychologistId: userId, demo: false, pending: false } });
}

export type ConfirmGate = {
  ok: boolean;
  /** Чем подтверждение оплачено: подписка или свободное место из трёх. */
  reason: "pro" | "seat" | "needs_pro";
  used: number;
  limit: number;
};

/**
 * Можно ли подтвердить запись, пришедшую снаружи. Это единственное место, где
 * платформа берёт деньги за приведённого человека, поэтому правило одно на все
 * входы: у PRO вопросов нет; на бесплатном тарифе есть три места, и пока они
 * не заняты, подтверждение ничего не стоит; когда мест не осталось — нужна
 * подписка. Пробные дни к подтверждению отношения не имеют: их выдают один раз
 * при верификации анкеты, отдельного триала «по заявке» нет.
 */
export async function confirmGate(userId: number): Promise<ConfirmGate> {
  const acc = await access(userId);
  const used = await countSeats(userId);
  if (acc.pro) return { ok: true, reason: "pro", used, limit: FREE_CLIENT_LIMIT };
  if (used < FREE_CLIENT_LIMIT) return { ok: true, reason: "seat", used, limit: FREE_CLIENT_LIMIT };
  return { ok: false, reason: "needs_pro", used, limit: FREE_CLIENT_LIMIT };
}

/**
 * Отказ на подтверждении записи. Видит его только специалист, поэтому здесь
 * причина названа прямо — в отличие от `NOT_ACCEPTING`, который читает клиент.
 */
export const NEEDS_PRO = {
  error: "needs_pro",
  message: `Бесплатно можно вести ${FREE_CLIENT_LIMIT} клиентов. Чтобы подтвердить встречу с новым человеком, нужна подписка PRO.`,
} as const;

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
  const used = await countSeats(userId);
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
      text: `${head} (${FREE_CLIENT_LIMIT}) — записаться к вам по-прежнему можно, но подтвердить встречу с новым человеком получится только на PRO. Анкета из каталога никуда не пропадает.`,
    },
  });
}

/** Те же данные пачкой — каталогу нужно решение сразу по десяткам анкет. */
export async function acceptingByIds(ids: number[], proIds: Set<number>): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const counts = await prisma.client.groupBy({
    by: ["psychologistId"],
    where: { psychologistId: { in: ids }, demo: false, pending: false },
    _count: { _all: true },
  });
  const usedOf = new Map(counts.map((row) => [row.psychologistId as number, row._count._all]));
  return new Set(ids.filter((id) => hasFreeSeat(proIds.has(id), usedOf.get(id) ?? 0)));
}

/** За какой срок считаем активность специалиста для порядка в каталоге. */
export const ACTIVITY_WINDOW_DAYS = 30;

/**
 * Порядок в каталоге. Деньги на него не влияют: выше стоит тот, кто чаще
 * заходит, потому что человеку, который выбирает специалиста, важно попасть к
 * живому — отвечающему на записи, а не к анкете, брошенной полгода назад.
 * Балл — число заходов за месяц; при равенстве выигрывает тот, кто заходил
 * недавнее.
 */
export async function activityRank(ids: number[]): Promise<Map<number, { hits: number; last: number }>> {
  const rank = new Map<number, { hits: number; last: number }>();
  if (ids.length === 0) return rank;

  const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000);
  const rows = await prisma.visit.groupBy({
    by: ["userId"],
    where: { userId: { in: ids }, createdAt: { gte: since } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  for (const row of rows) {
    if (row.userId == null) continue;
    rank.set(row.userId, { hits: row._count._all, last: row._max.createdAt?.getTime() ?? 0 });
  }
  return rank;
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
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { psyStatus: true, deletedAt: true, blockedAt: true } });
  // Удалённый или заблокированный аккаунт одобренным не считается: его ссылка
  // приглашения продолжала работать и заводила клиенту связь с тем, кого на
  // платформе больше нет.
  if (user?.deletedAt || user?.blockedAt) return false;
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
