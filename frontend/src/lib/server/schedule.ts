// Расписание на сервере: шаблон рабочих часов + правки на конкретные даты.
// Логика повторяет демо-мок один в один — клиентский код не должен заметить
// подмены хранилища.

import { prisma } from "@/lib/server/prisma";

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
export type OverrideDTO = { removed?: boolean; fmt?: SlotFormat };

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
  const psy = await prisma.psyProfile.findUnique({ where: { userId: id }, select: { status: true } });
  return psy?.status === "approved" ? id : null;
}

/** Правки окон в виде, в котором их ждёт клиент: ключ — ISO начала окна. */
/** Окно, за пределами которого данные расписания экрану не нужны. */
export type Range = { from: Date; to: Date };

/** Ближайшие N дней от полуночи сегодня — ровно то, что рисует календарь. */
export function horizon(days = 60, back = 0): Range {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - back);
  const to = new Date(from);
  to.setDate(to.getDate() + days + back);
  return { from, to };
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

  // Пустая правка (окно открыто и формат как в шаблоне) не хранится:
  // иначе таблица растёт от каждого щелчка туда-обратно.
  if (!removed && !fmt) {
    if (existing) await prisma.slotOverride.delete({ where: { id: existing.id } });
  } else {
    await prisma.slotOverride.upsert({
      where: { userId_startsAt: { userId, startsAt } },
      create: { userId, startsAt, removed, fmt },
      update: { removed, fmt },
    });
  }
  return getOverrides(userId);
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
  const day = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(day.getTime())) return [];
  const weekday = (day.getDay() + 6) % 7;
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
    const at = new Date(day);
    at.setHours(hh, mm, 0, 0);
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
  return out;
}

const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

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
  const withAppt = new Set(busy.map((b) => ymd(new Date(b.start))));
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const key = ymd(d);
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
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const slots = slotsFor(work, ymd(d), busy, overrides, true);
    if (slots.some((s) => !s.taken)) return i === 0 ? 1 : i;
  }
  return days;
}

/** Занятые интервалы психолога: всё, что не отменено. */
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
  return appts.map((a) => ({ start: a.startsAt.toISOString(), minutes: a.durationMin }));
}
