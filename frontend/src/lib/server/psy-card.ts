import { availabilityFromWorkHours } from "@/lib/availability";
import { publicRules } from "@/lib/profile-rules";
import { prisma } from "@/lib/server/prisma";
import { horizon, nextFreeSlotDays, type OverrideDTO, type WorkHoursDTO } from "@/lib/server/schedule";

// Единственная сборка публичной карточки специалиста. Раньше её умел только
// каталог, а раздел «Терапия» получал из `/my/therapists` голые id с именем и
// дорисовывал остальное из статического `PSYS` — в бою пустого. Отсюда и
// «специалист без аватарки»: закреплённый терапевт выглядел иначе, чем та же
// карточка в каталоге.
export type PsyProfileRow = Awaited<ReturnType<typeof prisma.psyProfile.findMany>>[number];

export type PsyCard = ReturnType<typeof mapCard>;

function mapCard(row: PsyProfileRow, ctx: {
  rating: number;
  reviews: number;
  sessions: number;
  nextDays: number;
  availability: ReturnType<typeof availabilityFromWorkHours>;
}) {
  const data = (row.data as Record<string, unknown>) ?? {};
  const location = (data.location ?? {}) as Record<string, unknown>;
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
    minutes: row.sessionMinutes,
    format: row.format,
    topics: data.topics ?? [],
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
    showStats: data.showStats !== false,
    rules: publicRules(data.rules),
    style: data.style ?? "",
    quote: data.quote ?? "",
    photos: data.photos ?? [],
    portrait: (data.photos as string[] | undefined)?.[0] ?? "",
    // Из адреса — только город и район: точное место после записи.
    city: location.city ?? row.city ?? "",
    district: location.district ?? "",
    metro: location.metro ?? "",
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
      where: { psychologistId: { in: ids }, status: "done" },
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
    const hours = (work?.hours ?? {}) as Record<number, { t: string }[]>;
    return mapCard(row, {
      rating: reviewOf.get(row.userId)?.rating ?? 0,
      reviews: reviewOf.get(row.userId)?.count ?? 0,
      sessions: doneOf.get(row.userId) ?? 0,
      availability: availabilityFromWorkHours({ hours }),
      nextDays: work
        ? nextFreeSlotDays(
            { ...work, hours: (work.hours ?? {}) as WorkHoursDTO["hours"] },
            busyOf.get(row.userId) ?? [],
            overridesOf.get(row.userId) ?? {},
          )
        : 14,
    });
  });
}

/** Карточки по списку id — для разделов, которые уже знают, кто им нужен. */
export async function psyCardsByIds(ids: number[]): Promise<PsyCard[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.psyProfile.findMany({ where: { userId: { in: ids } } });
  return buildPsyCards(rows);
}
