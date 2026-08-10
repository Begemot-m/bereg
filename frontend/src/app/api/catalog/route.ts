import { NextResponse, type NextRequest } from "next/server";

import { availabilityFromWorkHours } from "@/lib/availability";
import { publicRules } from "@/lib/profile-rules";
import { catalogPlacement } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { horizon, nextFreeSlotDays, type OverrideDTO, type WorkHoursDTO } from "@/lib/server/schedule";

export const runtime = "nodejs";


// Каталог открыт без входа: человек должен увидеть специалистов до регистрации.
// Отдаём только опубликованные анкеты и только публичные поля — точный адрес
// и контакты сюда не попадают, они открываются после подтверждённой записи.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const maxPrice = Number(url.searchParams.get("maxPrice") ?? 0);

  // ?id=<userId> — одна анкета для ссылки-приглашения. Размещение в каталоге
  // тут не требуется: по прямой ссылке специалист открывается и без PRO.
  const one = Number(url.searchParams.get("id"));

  const found = await prisma.psyProfile.findMany({
    where: one > 0
      ? { userId: one, status: "approved" }
      : {
          status: "approved",
          ...(format && format !== "any" ? { OR: [{ format }, { format: "both" }] } : {}),
          ...(maxPrice > 0 ? { sessionPrice: { lte: maxPrice } } : {}),
        },
    orderBy: { sessionPrice: "asc" },
    take: one > 0 ? 1 : 200,
  });

  // Одобренной анкеты мало: место в каталоге держат либо оплаченный PRO, либо
  // бесплатные 14 дней после одобрения. Кончилось и то и другое — карточка
  // уходит из выдачи, хотя сама анкета остаётся подтверждённой.
  // По прямой ссылке (?id=) карточка открывается и без размещения: человек
  // пришёл к конкретному специалисту, а не искал его в каталоге.
  const subs = await prisma.subscription.findMany({
    where: { psychologistId: { in: found.map((row) => row.userId) } },
    select: { psychologistId: true, status: true, currentPeriodEnd: true },
  });
  const subOf = new Map(subs.map((row) => [row.psychologistId, row]));
  const rows = one > 0
    ? found
    : found.filter((row) => {
        const sub = subOf.get(row.userId);
        return catalogPlacement({
          status: row.status,
          reviewedAt: row.reviewedAt,
          subStatus: sub?.status,
          currentPeriodEnd: sub?.currentPeriodEnd,
        }).placed;
      });

  // Окна для фильтра «когда удобно» берём из графика специалиста: заполнил
  // расписание — его дни и время сразу участвуют в подборке.
  // Ближайшее окно считается по тому же расчёту, что и календарь записи:
  // шаблон недели минус снятые даты минус занятые окна, с правилом
  // предварительной записи. По одному шаблону карточка обещала запись раньше,
  // чем её показывал календарь.
  const ids = rows.map((row) => row.userId);
  const range = horizon(14);
  const [schedules, overrideRows, busyRows] = await Promise.all([
    prisma.workHours.findMany({ where: { userId: { in: ids } } }),
    prisma.slotOverride.findMany({ where: { userId: { in: ids }, startsAt: { gte: range.from, lte: range.to } } }),
    prisma.appointment.findMany({
      where: { psychologistId: { in: ids }, status: { not: "cancelled" }, startsAt: { gte: range.from, lte: range.to } },
      select: { psychologistId: true, startsAt: true, durationMin: true },
    }),
  ]);

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
  const scheduleOf = new Map(schedules.map((row) => [row.userId, (row.hours ?? {}) as Record<number, { t: string }[]>]));

  const psys = rows.map((row) => {
    const data = (row.data as Record<string, unknown>) ?? {};
    const location = (data.location ?? {}) as Record<string, unknown>;
    const hours = scheduleOf.get(row.userId);
    const work = workOf.get(row.userId);
    const availability = availabilityFromWorkHours({ hours });
    return {
      availability: availability.slots ? availability : undefined,
      availableTimes: availability.times,
      nextDays: work
        ? nextFreeSlotDays(
            { ...work, hours: (work.hours ?? {}) as WorkHoursDTO["hours"] },
            busyOf.get(row.userId) ?? [],
            overridesOf.get(row.userId) ?? {},
          )
        : 14,
      id: row.userId,
      name: row.name,
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
      city: location.city ?? "",
      district: location.district ?? "",
      metro: location.metro ?? "",
    };
  });

  return NextResponse.json(psys);
}
