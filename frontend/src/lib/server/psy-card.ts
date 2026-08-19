import { Prisma } from "@prisma/client";

import { EMPTY_AVAILABILITY, type Availability } from "@/lib/availability";
import { publicRules } from "@/lib/profile-rules";
import { prisma } from "@/lib/server/prisma";
import { freeAvailability, horizon, nextFreeSlotDays, type OverrideDTO, type WorkHoursDTO } from "@/lib/server/schedule";

// Единственная сборка публичной карточки специалиста. Раньше её умел только
// каталог, а раздел «Терапия» получал из `/my/therapists` голые id с именем и
// дорисовывал остальное из статического `PSYS` — в бою пустого. Отсюда и
// «специалист без аватарки»: закреплённый терапевт выглядел иначе, чем та же
// карточка в каталоге.
// `photoCount` появляется, когда анкету читают без самих снимков (так делает
// каталог): считать длину `data.photos` тогда не по чему.
export type PsyProfileRow = Awaited<ReturnType<typeof prisma.psyProfile.findMany>>[number] & { photoCount?: number };

export type PsyCard = ReturnType<typeof mapCard>;

/// Сколько снимков карточка вообще показывает.
export const MAX_PHOTOS = 3;

/**
 * Ссылки на фотографии анкеты. Сам снимок лежит data-URL'ом внутри Json, и
 * подставлять его в карточку нельзя: список каталога распухал до мегабайта на
 * человека — без кеша и без ленивой загрузки. Отдаём адреса роута
 * `/api/catalog/photo`, а версия в `?v=` меняется вместе с анкетой: браузер
 * держит снимок в кеше ровно до тех пор, пока психолог его не заменил.
 */
export function psyPhotoUrls(row: Pick<PsyProfileRow, "userId" | "updatedAt" | "photoCount">, data: Record<string, unknown>): string[] {
  const stored = Array.isArray(data.photos) ? (data.photos as unknown[]).filter(Boolean).length : 0;
  const count = Math.min(row.photoCount ?? stored, MAX_PHOTOS);
  const version = row.updatedAt instanceof Date ? row.updatedAt.getTime() : 0;
  return Array.from({ length: count }, (_, index) => `/api/catalog/photo/${row.userId}/${index}?v=${version}`);
}

function mapCard(row: PsyProfileRow, ctx: {
  rating: number;
  reviews: number;
  sessions: number;
  nextDays: number;
  availability: Availability;
}) {
  const data = (row.data as Record<string, unknown>) ?? {};
  const location = (data.location ?? {}) as Record<string, unknown>;
  const photos = psyPhotoUrls(row, data);
  return {
    availability: ctx.availability.slots ? ctx.availability : undefined,
    availableTimes: ctx.availability.times,
    nextDays: ctx.nextDays,
    id: row.userId,
    name: row.name,
    rating: ctx.rating,
    reviews: ctx.reviews,
    sessions: ctx.sessions,
    method: row.primaryMethod,
    methods: data.methods ?? [],
    years: row.experienceYears,
    price: row.sessionPrice,
    // Валюта, регион и часовой пояс живут в JSON анкеты: колонок под них нет,
    // а карточке они нужны — специалисты вне России берут оплату не в рублях.
    currency: data.currency ?? "RUB",
    minutes: row.sessionMinutes,
    region: location.region ?? "",
    timezone: data.timezone ?? "",
    format: row.format,
    topics: data.topics ?? [],
    topTopics: data.topTopics ?? [],
    avoids: data.avoids ?? [],
    about: data.about ?? "",
    firstSession: data.firstSession ?? "",
    education: data.education ?? [],
    languages: data.languages ?? [],
    specialistTypes: data.specialistTypes ?? [],
    // Пол специалиста — фильтр в каталоге; без него анкета выпадала из
    // подборки, стоило клиенту выбрать «женщина» или «мужчина».
    gender: data.gender ?? "unspecified",
    // Настройки анкеты: счётчики и правила показываются, только если
    // специалист отметил это у себя в профиле.
    // Счётчики платформы — только по явному согласию: анкеты без этого поля
    // (а такими были все до сегодняшнего дня) карточка показывает без цифр.
    showStats: data.showStats === true,
    rules: publicRules(data.rules),
    style: data.style ?? "",
    quote: data.quote ?? "",
    photos,
    portrait: photos[0] ?? "",
    city: location.city ?? row.city ?? "",
    district: location.district ?? "",
    metro: location.metro ?? "",
    // Точный адрес — только если специалист сам открыл его в анкете; иначе
    // карточка честно говорит, что место есть и его назовут после записи.
    address: location.publicExactAddress ? String(location.address ?? "").trim() || undefined : undefined,
    publicExactAddress: Boolean(location.publicExactAddress),
    privateAddressAvailable: !location.publicExactAddress && Boolean(String(location.address ?? "").trim()),
    // Контакты из анкеты каталог наружу не отдавал вовсе — в бою блок
    // «Написать в Telegram» работал только на своей карточке.
    tg: String(data.tg ?? "").trim().replace(/^@/, ""),
    links: Array.isArray(data.links) ? data.links : [],
    // Статус анкеты нужен разделу «Терапия»: закреплённый специалист может
    // ещё не пройти верификацию, и карточка должна сказать об этом честно,
    // вместо того чтобы молча притворяться каталожной.
    verified: row.status === "approved",
  };
}

/**
 * Карточки специалистов по готовым строкам анкет. Занятые окна, снятые даты,
 * отзывы и счётчик встреч подтягиваются одним заходом на всю пачку.
 */
export async function buildPsyCards(rows: PsyProfileRow[]): Promise<PsyCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.userId);
  const range = horizon(14);
  const [schedules, overrideRows, busyRows, reviewRows, doneRows] = await Promise.all([
    prisma.workHours.findMany({ where: { userId: { in: ids } } }),
    prisma.slotOverride.findMany({ where: { userId: { in: ids }, startsAt: { gte: range.from, lte: range.to } } }),
    prisma.appointment.findMany({
      where: { psychologistId: { in: ids }, status: { not: "cancelled" }, startsAt: { gte: range.from, lte: range.to } },
      select: { psychologistId: true, startsAt: true, durationMin: true },
    }),
    // Рейтинг и счётчики карточки — из базы, а не константы. Раньше боевым
    // анкетам проставлялись нули, и сортировка «по рейтингу» сравнивала нули.
    prisma.review.groupBy({ by: ["psychologistId"], where: { psychologistId: { in: ids } }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.appointment.groupBy({
      by: ["psychologistId"],
      // Карточка-пример в публичные счётчики не идёт: в каталоге должна стоять
      // настоящая практика, а не показательные встречи из демо-карточки.
      where: { psychologistId: { in: ids }, status: "done", client: { demo: false } },
      _count: { _all: true },
    }),
  ]);

  const reviewOf = new Map(reviewRows.map((r) => [r.psychologistId, { rating: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count._all }]));
  const doneOf = new Map(doneRows.map((r) => [r.psychologistId, r._count._all]));
  const workOf = new Map(schedules.map((row) => [row.userId, row]));

  const overridesOf = new Map<number, Record<string, OverrideDTO>>();
  for (const row of overrideRows) {
    const bag = overridesOf.get(row.userId) ?? {};
    bag[row.startsAt.toISOString()] = {
      ...(row.removed ? { removed: true } : {}),
      ...(row.fmt ? { fmt: row.fmt as "online" | "offline" } : {}),
    };
    overridesOf.set(row.userId, bag);
  }
  const busyOf = new Map<number, { start: string; minutes: number }[]>();
  for (const row of busyRows) {
    const list = busyOf.get(row.psychologistId) ?? [];
    list.push({ start: row.startsAt.toISOString(), minutes: row.durationMin });
    busyOf.set(row.psychologistId, list);
  }

  return rows.map((row) => {
    const work = workOf.get(row.userId);
    const dto = work ? { ...work, hours: (work.hours ?? {}) as WorkHoursDTO["hours"] } : null;
    const busy = busyOf.get(row.userId) ?? [];
    const overrides = overridesOf.get(row.userId) ?? {};
    return mapCard(row, {
      rating: reviewOf.get(row.userId)?.rating ?? 0,
      reviews: reviewOf.get(row.userId)?.count ?? 0,
      sessions: doneOf.get(row.userId) ?? 0,
      // Доступность считаем по свободным окнам, а не по шаблону недели: иначе
      // фильтр «когда удобно» обещает время, которое уже занято.
      availability: dto ? freeAvailability(dto, busy, overrides) : EMPTY_AVAILABILITY,
      nextDays: dto ? nextFreeSlotDays(dto, busy, overrides) : 14,
    });
  });
}

/**
 * Анкеты без самих фотографий. Снимки лежат data-URL'ом в Json, и обычный
 * `findMany` поднимал их из базы целиком: две сотни анкет — это сотни
 * мегабайт base64 в памяти сервера на каждый заход в каталог. Карточке хватает
 * их числа, а байты она берёт из `/api/catalog/photo`.
 */
export function psyProfileRows(where: Prisma.Sql, limit: number): Promise<PsyProfileRow[]> {
  return prisma.$queryRaw<PsyProfileRow[]>`
    SELECT "userId", "name", "primaryMethod", "experienceYears", "sessionPrice", "sessionMinutes",
           "format", "city", "status", "rejectReason", "submittedAt", "reviewedAt", "updatedAt",
           "data" - 'photos' AS "data",
           (CASE WHEN jsonb_typeof("data"->'photos') = 'array' THEN jsonb_array_length("data"->'photos') ELSE 0 END)::int AS "photoCount"
      FROM "PsyProfile"
     WHERE ${where}
     ORDER BY "sessionPrice" ASC
     LIMIT ${limit}
  `;
}

/** Карточки по списку id — для разделов, которые уже знают, кто им нужен. */
export async function psyCardsByIds(ids: number[]): Promise<PsyCard[]> {
  if (ids.length === 0) return [];
  const rows = await psyProfileRows(Prisma.sql`"userId" IN (${Prisma.join(ids)})`, ids.length);
  return buildPsyCards(rows);
}
