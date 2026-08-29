// Карточка клиента в том виде, в каком её ждёт интерфейс: строка из базы плюс
// шесть чисел рядом с именем — сколько встреч прошло, когда следующая, как идут
// задания. Раньше их считало только демо, а боевой роут отдавал сырую строку:
// в проде у каждого клиента было «0 сессий», а статус вычислялся как «Пауза».
//
// Считаем группировками, а не выборкой записей: у практикующего психолога их за
// год тысячи, и тянуть всё в память ради шести чисел незачем.

import { createHmac } from "node:crypto";

import { env } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

export type ClientStats = {
  sessionsDone: number;
  hoursDone: number;
  nextAt: string | null;
  lastAt: string | null;
  hwTotal: number;
  hwDone: number;
};

const EMPTY: ClientStats = { sessionsDone: 0, hoursDone: 0, nextAt: null, lastAt: null, hwTotal: 0, hwDone: 0 };

// Дольше этого сессий не бывает: окно, за которое ещё имеет смысл проверять,
// не идёт ли встреча прямо сейчас.
const MAX_SESSION_MS = 6 * 60 * 60_000;

export async function statsFor(clientIds: number[]): Promise<Map<number, ClientStats>> {
  const out = new Map<number, ClientStats>();
  if (clientIds.length === 0) return out;

  const where = { clientId: { in: clientIds } };
  const [done, upcoming, hwTotal, hwDone] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { ...where, status: "done" },
      _count: { _all: true },
      _sum: { durationMin: true },
      _max: { startsAt: true },
    }),
    // Ближайшая встреча — та, чьё время ещё не вышло целиком. По `startsAt >
    // now` идущая сессия пропадала из списка клиентов ровно в свой час, будто
    // её и не было. Длительность в SQL не сложить через groupBy, поэтому
    // берём короткое окно назад и отбираем по концу встречи в памяти.
    prisma.appointment.findMany({
      where: { ...where, status: "scheduled", startsAt: { gt: new Date(Date.now() - MAX_SESSION_MS) } },
      select: { clientId: true, startsAt: true, durationMin: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.homework.groupBy({ by: ["clientId"], where, _count: { _all: true } }),
    prisma.homework.groupBy({ by: ["clientId"], where: { ...where, status: "done" }, _count: { _all: true } }),
  ]);

  for (const id of clientIds) out.set(id, { ...EMPTY });
  for (const row of done) {
    const stats = out.get(row.clientId);
    if (!stats) continue;
    stats.sessionsDone = row._count._all;
    stats.hoursDone = Math.round(((row._sum.durationMin ?? 0) / 60) * 10) / 10;
    stats.lastAt = row._max.startsAt?.toISOString() ?? null;
  }
  const nowMs = Date.now();
  for (const row of upcoming) {
    if (+row.startsAt + row.durationMin * 60_000 <= nowMs) continue;
    const stats = out.get(row.clientId);
    if (!stats || stats.nextAt) continue;
    stats.nextAt = row.startsAt.toISOString();
  }
  for (const row of hwTotal) {
    const stats = out.get(row.clientId);
    if (stats) stats.hwTotal = row._count._all;
  }
  for (const row of hwDone) {
    const stats = out.get(row.clientId);
    if (stats) stats.hwDone = row._count._all;
  }
  return out;
}

/** Что подмешать к выборке карточки, чтобы отдать аватарку и ник подключённого клиента. */
export const PHOTO_INCLUDE = { user: { select: { photoUrl: true, username: true } } } as const;

type MaybeUser = {
  user?: { photoUrl: string | null; username?: string | null } | null;
  id?: number;
  tgUserId?: bigint | null;
  tgUsername?: string | null;
  tgPhotoId?: string | null;
};
type Photo<T> = Omit<T, "user" | "tgUserId" | "tgUsername" | "tgPhotoId"> & { photo: string | null; tg: string | null };

/**
 * Фото клиента берётся из его аккаунта: карточку заводит психолог, а аватарка
 * есть только у того, кто вошёл через Telegram. Сам `user` наружу не отдаём —
 * интерфейсу нужна одна ссылка, а не кусок чужого профиля. Карточка без
 * подключённого аккаунта проходит здесь же и получает `photo: null`.
 *
 * Оттуда же берётся `tg` — ник подключённого аккаунта. Без него «Написать»
 * работало только если психолог сам вписал в контакт username: у клиента,
 * пришедшего по ссылке, кнопка вела в никуда.
 */
export function withPhoto<T extends object>(row: T): Photo<T> {
  const { user, tgUserId, tgUsername, tgPhotoId, ...rest } = row as T & MaybeUser;
  // У демо-карточки аккаунта нет и быть не может, а буква вместо лица делает
  // её похожей на недозаполненную настоящую. Отдаём портрет из public.
  const demo = (row as { demo?: boolean }).demo === true;
  // Карточка, заведённая выбором контакта: лицо и ник есть, аккаунта нет.
  // Аватарка идёт ссылкой на прокси — file_id наружу не отдаём, а base64
  // в списке из сотни карточек весил бы мегабайты. `tgUserId` тоже остаётся
  // внутри: это BigInt, JSON его не сериализует.
  const id = (row as { id?: number }).id;
  const contactPhoto = tgPhotoId && id ? `/api/clients/photo/${id}?s=${photoSig(id, tgPhotoId)}` : null;
  return {
    ...rest,
    photo: user?.photoUrl ?? contactPhoto ?? (demo ? DEMO_CLIENT_PHOTO : null),
    tg: user?.username ?? tgUsername ?? null,
  } as Photo<T>;
}

/**
 * Подпись ссылки на аватарку контакта. Картинку тянет `<img>`, а заголовок
 * авторизации туда не подставить — поэтому доступ даёт подпись, а не сессия:
 * узнать её может только тот, кому сервер отдал карточку. Меняется вместе с
 * `file_id`, и старый адрес перестаёт работать сам.
 */
export function photoSig(id: number, fileId: string): string {
  return createHmac("sha256", env.jwtSecret).update(`photo:${id}:${fileId}`).digest("base64url").slice(0, 12);
}

/** Портрет демо-карточки — файл из public, аккаунта за ним нет. */
export const DEMO_CLIENT_PHOTO = "/demo-client.webp";

/** Клиент внутри записи — те же поля плюс аватарка. */
export const APPT_CLIENT_SELECT = { id: true, name: true, demo: true, tgPhotoId: true, user: { select: { photoUrl: true } } } as const;

export function apptWithPhoto<T extends { client: object }>(row: T): Omit<T, "client"> & { client: Photo<T["client"]> } {
  return { ...row, client: withPhoto(row.client) };
}

type Row = { id: number };

/** Строки карточек + их статистика. Порядок сохраняется. */
export async function withStats<T extends Row>(rows: T[]): Promise<(T & ClientStats)[]> {
  const stats = await statsFor(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, ...(stats.get(row.id) ?? EMPTY) }));
}

/** То же для одной карточки. */
export async function withStatsOne<T extends Row>(row: T): Promise<T & ClientStats> {
  return (await withStats([row]))[0];
}
