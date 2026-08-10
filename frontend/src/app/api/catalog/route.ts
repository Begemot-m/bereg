import { NextResponse, type NextRequest } from "next/server";

import { availabilityFromWorkHours, nextSlotDays } from "@/lib/availability";
import { publicRules } from "@/lib/profile-rules";
import { catalogPlacement } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";

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
  const schedules = await prisma.workHours.findMany({
    where: { userId: { in: rows.map((row) => row.userId) } },
    select: { userId: true, hours: true },
  });
  const scheduleOf = new Map(schedules.map((row) => [row.userId, (row.hours ?? {}) as Record<number, { t: string }[]>]));

  const psys = rows.map((row) => {
    const data = (row.data as Record<string, unknown>) ?? {};
    const location = (data.location ?? {}) as Record<string, unknown>;
    const hours = scheduleOf.get(row.userId);
    const availability = availabilityFromWorkHours({ hours });
    return {
      availability: availability.slots ? availability : undefined,
      availableTimes: availability.times,
      // Через сколько дней ближайшее окно — из настоящего графика. Раньше
      // карточка всем писала «через 7 дней», и «запись на этой неделе»
      // фильтровала не по расписанию, а по константе.
      nextDays: nextSlotDays({ hours }),
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
