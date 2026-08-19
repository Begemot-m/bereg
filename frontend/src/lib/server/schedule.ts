// Расписание на сервере: шаблон рабочих часов + правки на конкретные даты.
// Логика повторяет демо-мок один в один — клиентский код не должен заметить
// подмены хранилища.

import { buildAvailability, timeOfDay, type Availability, type DayGroup } from "@/lib/availability";
import type { TimeOfDay } from "@/lib/catalog";
import { canWorkWithPsy } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { pinManualDays as planPins, sameHours } from "@/lib/schedule-pin";
import { addDays, parseYmd, weekdayOf, zonedDayStart, zonedTime, zoneHour, zoneYmd } from "@/lib/server/zone";

export type SlotFormat = "online" | "offline";
export type WorkSlot = { t: string; d: number; fmt: SlotFormat };
export type WorkHoursDTO = {
  hours: Record<number, WorkSlot[]>;
  sessionMinutes: number;
  cancelLockDays: number;
  leadDaysOffline: number;
  leadDaysOnline: number;
  /** Границы шкалы в редакторе: «работаю с 9 до 22». */
  dayFrom: number;
  dayTo: number;
};
export type SlotDTO = { start: string; taken: boolean; fmt: SlotFormat };
/** Занятый интервал психолога: начало записи и её длительность. */
export type Busy = { start: string; minutes: number };
export type OverrideDTO = { removed?: boolean; fmt?: SlotFormat; added?: boolean; dur?: number };

const DEFAULT_HOURS: WorkHoursDTO = { hours: {}, sessionMinutes: 50, cancelLockDays: 0, leadDaysOffline: 0, leadDaysOnline: 0, dayFrom: 9, dayTo: 21 };

/** Запрет отмены — целое число дней от 0 (без ограничения) до недели. */
const clampLock = (days: number) => Math.min(7, Math.max(0, Math.trunc(days) || 0));
/** Предварительная запись — до месяца вперёд; дальше это уже не «заранее». */
export const clampLead = (days: number) => Math.min(30, Math.max(0, Math.trunc(days) || 0));
const clampHour = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(value) || 0));

type WorkHoursRow = {
  hours: unknown;
  sessionMinutes: number;
  cancelLockDays: number;
  leadDaysOffline: number;
  leadDaysOnline: number;
  dayFrom: number;
  dayTo: number;
};

const toDTO = (row: WorkHoursRow): WorkHoursDTO => ({
  hours: (row.hours as WorkHoursDTO["hours"]) ?? {},
  sessionMinutes: row.sessionMinutes,
  cancelLockDays: row.cancelLockDays,
  leadDaysOffline: row.leadDaysOffline,
  leadDaysOnline: row.leadDaysOnline,
  dayFrom: row.dayFrom,
  dayTo: row.dayTo,
});

export async function getWorkHours(userId: number): Promise<WorkHoursDTO> {
  const row = await prisma.workHours.findUnique({ where: { userId } });
  if (!row) return DEFAULT_HOURS;
  return toDTO(row);
}

export async function saveWorkHours(userId: number, patch: Partial<WorkHoursDTO>): Promise<WorkHoursDTO> {
  const current = await getWorkHours(userId);
  const hours = patch.hours ?? current.hours;
  // Новый шаблон идёт вперёд, но даты, которые правили руками, остаются
  // такими, какими их оставили: перед записью прибиваем их разовыми окнами.
  if (patch.hours !== undefined && !sameHours(current.hours, hours)) {
    await pinManualDays(userId, current, { ...current, hours, sessionMinutes: patch.sessionMinutes ?? current.sessionMinutes });
  }
  const sessionMinutes = patch.sessionMinutes ?? current.sessionMinutes;
  const cancelLockDays = patch.cancelLockDays === undefined ? current.cancelLockDays : clampLock(patch.cancelLockDays);
  const leadDaysOffline = patch.leadDaysOffline === undefined ? current.leadDaysOffline : clampLead(patch.leadDaysOffline);
  const leadDaysOnline = patch.leadDaysOnline === undefined ? current.leadDaysOnline : clampLead(patch.leadDaysOnline);
  // Границы шкалы: с 0 до 24, «до» строго больше «с» — иначе сетка схлопнется.
  const dayFrom = clampHour(patch.dayFrom ?? current.dayFrom, 0, 23);
  const dayTo = Math.max(dayFrom + 1, clampHour(patch.dayTo ?? current.dayTo, 1, 24));
  const data = { hours, sessionMinutes, cancelLockDays, leadDaysOffline, leadDaysOnline, dayFrom, dayTo };
  const row = await prisma.workHours.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return toDTO(row);
}

/**
 * Чьё расписание показываем. Клиент записывается к специалисту, а не к себе:
 * без явного id считали окна текущего пользователя, и по ссылке-приглашению
 * человек видел собственное пустое расписание.
 */
export async function resolveScheduleOwner(viewerId: number, psyParam: string | null): Promise<number | null> {
  const id = Number(psyParam);
  if (!psyParam || !Number.isInteger(id) || id <= 0 || id === viewerId) return viewerId;
  // Приглашённый клиент видит окна и до верификации: иначе он открывает анкету
  // специалиста, который его позвал, и получает пустой календарь.
  return (await canWorkWithPsy(viewerId, id)) ? id : null;
}

/** Правки окон в виде, в котором их ждёт клиент: ключ — ISO начала окна. */
/** Окно, за пределами которого данные расписания экрану не нужны. */
export type Range = { from: Date; to: Date };

/** Ближайшие N дней от полуночи сегодня — ровно то, что рисует календарь. */
export function horizon(days = 60, back = 0): Range {
  const today = zoneYmd();
  return {
    from: zonedDayStart(addDays(today, -back))!,
    to: zonedDayStart(addDays(today, days))!,
  };
}

export async function getOverrides(userId: number, range?: Range): Promise<Record<string, OverrideDTO>> {
  // Без окна выборка растёт вместе с историей: через год работы это тысячи
  // строк, из которых экрану нужны десятки.
  const rows = await prisma.slotOverride.findMany({
    where: { userId, ...(range ? { startsAt: { gte: range.from, lte: range.to } } : {}) },
  });
  const out: Record<string, OverrideDTO> = {};
  for (const r of rows) {
    out[r.startsAt.toISOString()] = {
      ...(r.removed ? { removed: true } : {}),
      ...(r.fmt ? { fmt: r.fmt as SlotFormat } : {}),
      ...(r.added ? { added: true } : {}),
      ...(r.dur ? { dur: r.dur } : {}),
    };
  }
  return out;
}

export async function setOverride(userId: number, iso: string, patch: OverrideDTO) {
  const startsAt = new Date(iso);
  if (Number.isNaN(startsAt.getTime())) throw new Error("invalid iso");
  const existing = await prisma.slotOverride.findUnique({ where: { userId_startsAt: { userId, startsAt } } });
  const removed = patch.removed ?? existing?.removed ?? false;
  const fmt = patch.fmt ?? existing?.fmt ?? null;
  const added = patch.added ?? existing?.added ?? false;
  const dur = patch.dur ?? existing?.dur ?? null;

  // Пустая правка (окно открыто и формат как в шаблоне) не хранится:
  // иначе таблица растёт от каждого щелчка туда-обратно. Разовое окно —
  // не пустая правка: без строки в таблице оно бы исчезло.
  if (!removed && !fmt && !added) {
    if (existing) await prisma.slotOverride.delete({ where: { id: existing.id } });
  } else {
    await prisma.slotOverride.upsert({
      where: { userId_startsAt: { userId, startsAt } },
      create: { userId, startsAt, removed, fmt, added, dur },
      update: { removed, fmt, added, dur },
    });
  }
  return getOverrides(userId);
}

/**
 * Перед сменой шаблона недели: даты, где психолог уже правил окна руками,
 * переводим на разовые окна. Дальше новый график их не касается — он ложится
 * только на дни, которых никто не трогал.
 */
async function pinManualDays(userId: number, before: WorkHoursDTO, after: WorkHoursDTO) {
  const now = Date.now();
  const rows = await prisma.slotOverride.findMany({ where: { userId, startsAt: { gte: new Date(now) } } });
  if (!rows.length) return;
  const overrides: Record<string, OverrideDTO> = {};
  for (const r of rows) {
    overrides[r.startsAt.toISOString()] = {
      ...(r.removed ? { removed: true } : {}),
      ...(r.fmt ? { fmt: r.fmt as SlotFormat } : {}),
      ...(r.added ? { added: true } : {}),
      ...(r.dur ? { dur: r.dur } : {}),
    };
  }
  const writes = planPins(before, after, overrides, now);
  if (!writes.length) return;
  await prisma.$transaction(writes.map((w) => {
    const data = { removed: w.removed, fmt: w.fmt, added: w.added, dur: w.dur };
    return prisma.slotOverride.upsert({
      where: { userId_startsAt: { userId, startsAt: new Date(w.iso) } },
      create: { userId, startsAt: new Date(w.iso), ...data },
      update: data,
    });
  }));
}

/**
 * Правило психолога: за lockDays до встречи клиент её уже не отменит и не
 * перенесёт. 0 — ограничения нет. Прошедшую встречу трогать тоже нельзя.
 */
export function lockedByPolicy(startsAt: Date, lockDays: number, now = Date.now()): boolean {
  if (lockDays <= 0) return false;
  return (startsAt.getTime() - now) / 86_400_000 < lockDays;
}

/**
 * Обратная сторона того же правила: клиент записывается не позже, чем за
 * leadDays до встречи. Формат берётся из окна — очная запись обычно требует
 * большего запаса, чем онлайн. 0 — ограничения нет.
 */
export function leadBlocked(startsAt: Date, leadDays: number, now = Date.now()): boolean {
  if (leadDays <= 0) return false;
  return (startsAt.getTime() - now) / 86_400_000 < leadDays;
}

/** Сколько дней запаса требует окно этого формата. */
export const leadDaysFor = (work: Pick<WorkHoursDTO, "leadDaysOffline" | "leadDaysOnline">, fmt: SlotFormat) =>
  fmt === "offline" ? work.leadDaysOffline : work.leadDaysOnline;

/** Интервалы записей в миллисекундах — с ними сравниваются окна шаблона. */
export function busyRanges(busy: Busy[], sessionMinutes: number): [number, number][] {
  return busy
    .map((b) => {
      const from = new Date(b.start).getTime();
      return [from, from + (b.minutes || sessionMinutes) * 60000] as [number, number];
    })
    .filter(([from]) => !Number.isNaN(from));
}

/** Свободные окна на дату: шаблон дня минус снятые, с пометкой занятых. */
export function slotsFor(
  work: WorkHoursDTO,
  dateStr: string,
  busy: Busy[],
  overrides: Record<string, OverrideDTO>,
  // Правило предварительной записи применяется только к чужому расписанию:
  // психолог должен видеть и ближние окна, иначе он не запишет клиента сам.
  applyLead = false,
): SlotDTO[] {
  const date = parseYmd(dateStr);
  if (!date) return [];
  const weekday = weekdayOf(dateStr);
  const template = [...((work.hours ?? {})[weekday] ?? [])].sort((a, b) => a.t.localeCompare(b.t));
  const session = work.sessionMinutes || 50;
  // Запись занимает окно, даже если её время не совпадает с шаблоном минута
  // в минуту: сессия 11:30 закрывает окно 11:00, иначе календарь предлагает
  // время, в которое психолог уже занят.
  const ranges = busyRanges(busy, session);
  const now = Date.now();

  const out: SlotDTO[] = [];
  for (const slot of template) {
    const [hh, mm] = slot.t.split(":").map(Number);
    // Время шаблона — «настенное» время специалиста, поэтому момент считаем в
    // зоне платформы. Полагаться на TZ процесса нельзя: в контейнере это UTC.
    const at = zonedTime(date.y, date.m, date.d, hh, mm);
    if (at.getTime() < now) continue; // прошедшие окна не предлагаем
    const iso = at.toISOString();
    const ov = overrides[iso];
    if (ov?.removed) continue;
    const fmt = ov?.fmt ?? slot.fmt ?? "online";
    if (applyLead && leadBlocked(at, leadDaysFor(work, fmt), now)) continue;
    const from = at.getTime();
    const to = from + (slot.d || session) * 60000;
    out.push({ start: iso, taken: ranges.some(([bs, be]) => bs < to && from < be), fmt });
  }

  // Разовые окна: психолог открыл их на конкретную дату, в шаблоне их нет.
  for (const [iso, ov] of Object.entries(overrides)) {
    if (!ov.added || ov.removed) continue;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime()) || at.getTime() < now) continue;
    if (zoneYmd(at) !== dateStr) continue;
    if (out.some((s) => s.start === iso)) continue;
    const fmt = ov.fmt ?? "online";
    if (applyLead && leadBlocked(at, leadDaysFor(work, fmt), now)) continue;
    const from = at.getTime();
    const to = from + (ov.dur || session) * 60000;
    out.push({ start: iso, taken: ranges.some(([bs, be]) => bs < to && from < be), fmt });
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}

/** Занятость по дням на ближайшие два месяца — для точек в календаре. */
export function monthAvailability(
  work: WorkHoursDTO,
  busy: Busy[],
  overrides: Record<string, OverrideDTO>,
  applyLead = false,
): Record<string, "free" | "full"> {
  const out: Record<string, "free" | "full"> = {};
  // День с записью считается занятым, даже если рабочих часов на него не
  // задано: сессия есть, а календарь показывал день пустым.
  const withAppt = new Set(busy.map((b) => zoneYmd(new Date(b.start))));
  const today = zoneYmd();
  for (let i = 0; i < 60; i++) {
    const key = addDays(today, i);
    const slots = slotsFor(work, key, busy, overrides, applyLead);
    if (slots.length === 0) {
      if (withAppt.has(key)) out[key] = "full";
      continue;
    }
    out[key] = slots.some((s) => !s.taken) ? "free" : "full";
  }
  return out;
}

/**
 * Через сколько дней у специалиста ближайшее свободное окно. Каталог считал
 * это по одному шаблону недели — снятые даты и уже занятые окна в расчёт не
 * входили, и карточка обещала запись раньше, чем её показывал календарь.
 * 14 — «в ближайшие две недели окна нет».
 */
export function nextFreeSlotDays(
  work: WorkHoursDTO,
  busy: Busy[],
  overrides: Record<string, OverrideDTO>,
  days = 14,
): number {
  const today = zoneYmd();
  for (let i = 0; i < days; i++) {
    const slots = slotsFor(work, addDays(today, i), busy, overrides, true);
    if (slots.some((s) => !s.taken)) return i === 0 ? 1 : i;
  }
  return days;
}

/**
 * Слепок доступности по реально свободным окнам, а не по шаблону недели.
 * Шаблон не знает ни про снятые даты, ни про уже занятое время: фильтр «когда
 * удобно» показывал специалиста на вечер, который занят вторую неделю подряд.
 */
export function freeAvailability(
  work: WorkHoursDTO,
  busy: Busy[],
  overrides: Record<string, OverrideDTO>,
  days = 14,
): Availability {
  const dayGroups = new Set<DayGroup>();
  const times = new Set<TimeOfDay>();
  let slots = 0;
  const today = zoneYmd();
  for (let i = 0; i < days; i++) {
    const key = addDays(today, i);
    const group: DayGroup = weekdayOf(key) >= 5 ? "weekends" : "weekdays";
    for (const slot of slotsFor(work, key, busy, overrides, true)) {
      if (slot.taken) continue;
      slots++;
      dayGroups.add(group);
      times.add(timeOfDay(`${String(zoneHour(new Date(slot.start))).padStart(2, "0")}:00`));
    }
  }
  return buildAvailability(dayGroups, times, slots);
}

/**
 * Открыто ли это время у специалиста на самом деле. Клиент присылает начало
 * окна, но прислать он может что угодно: снятую дату, чужое время, окно ближе
 * запрета на запись. Правило должно стоять здесь — экран клиенту не указ.
 * `exceptAppointmentId` — перенос: своя же запись не должна считаться занятой.
 */
export async function checkSlotOpen(
  psychologistId: number,
  startsAt: Date,
  exceptAppointmentId?: number,
): Promise<{ ok: true; fmt: SlotFormat } | { ok: false; reason: "closed" | "taken" | "lead"; leadDays: number; fmt: SlotFormat }> {
  const ymd = zoneYmd(startsAt);
  const from = zonedDayStart(ymd)!;
  const to = zonedDayStart(addDays(ymd, 1))!;
  const [work, overrides, appts, meetings] = await Promise.all([
    getWorkHours(psychologistId),
    getOverrides(psychologistId, { from, to }),
    prisma.appointment.findMany({
      where: {
        psychologistId,
        status: { not: "cancelled" },
        startsAt: { gte: from, lte: to },
        ...(exceptAppointmentId ? { id: { not: exceptAppointmentId } } : {}),
      },
      select: { startsAt: true, durationMin: true },
    }),
    groupBusy(psychologistId, { from, to }),
  ]);
  const busy: Busy[] = [...appts.map((a) => ({ start: a.startsAt.toISOString(), minutes: a.durationMin })), ...meetings];
  const iso = startsAt.toISOString();
  const slot = slotsFor(work, ymd, busy, overrides, false).find((s) => s.start === iso);
  if (!slot) return { ok: false, reason: "closed", leadDays: 0, fmt: "online" };
  const leadDays = leadDaysFor(work, slot.fmt);
  if (slot.taken) return { ok: false, reason: "taken", leadDays, fmt: slot.fmt };
  if (leadBlocked(startsAt, leadDays)) return { ok: false, reason: "lead", leadDays, fmt: slot.fmt };
  return { ok: true, fmt: slot.fmt };
}

/**
 * Встречи групп в календаре специалиста. Занимают окно целиком: одна встреча —
 * это вся группа, записать в это время человека из каталога нельзя.
 */
export async function groupBusy(psychologistId: number, range?: Range): Promise<Busy[]> {
  const meetings = await prisma.groupMeeting.findMany({
    where: {
      group: { psychologistId, status: "active" },
      status: { not: "cancelled" },
      ...(range ? { startsAt: { gte: range.from, lte: range.to } } : {}),
    },
    select: { startsAt: true, durationMin: true },
  });
  return meetings.map((m) => ({ start: m.startsAt.toISOString(), minutes: m.durationMin }));
}

/** Занятые интервалы психолога: всё, что не отменено, включая встречи групп. */
export async function takenTimes(userId: number, range?: Range): Promise<Busy[]> {
  // Занятость нужна только на горизонте календаря. Раньше читались все
  // записи за всё время — и попадали в память ради проверки двух месяцев.
  const appts = await prisma.appointment.findMany({
    where: {
      psychologistId: userId,
      status: { not: "cancelled" },
      ...(range ? { startsAt: { gte: range.from, lte: range.to } } : {}),
    },
    select: { startsAt: true, durationMin: true },
  });
  const meetings = await groupBusy(userId, range);
  return [...appts.map((a) => ({ start: a.startsAt.toISOString(), minutes: a.durationMin })), ...meetings];
}
