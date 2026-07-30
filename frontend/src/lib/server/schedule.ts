// Расписание на сервере: шаблон рабочих часов + правки на конкретные даты.
// Логика повторяет демо-мок один в один — клиентский код не должен заметить
// подмены хранилища.

import { prisma } from "@/lib/server/prisma";

export type SlotFormat = "online" | "offline";
export type WorkSlot = { t: string; d: number; fmt: SlotFormat };
export type WorkHoursDTO = { hours: Record<number, WorkSlot[]>; sessionMinutes: number };
export type SlotDTO = { start: string; taken: boolean; fmt: SlotFormat };
export type OverrideDTO = { removed?: boolean; fmt?: SlotFormat };

const DEFAULT_HOURS: WorkHoursDTO = { hours: {}, sessionMinutes: 50 };

export async function getWorkHours(userId: number): Promise<WorkHoursDTO> {
  const row = await prisma.workHours.findUnique({ where: { userId } });
  if (!row) return DEFAULT_HOURS;
  return { hours: (row.hours as WorkHoursDTO["hours"]) ?? {}, sessionMinutes: row.sessionMinutes };
}

export async function saveWorkHours(userId: number, patch: Partial<WorkHoursDTO>): Promise<WorkHoursDTO> {
  const current = await getWorkHours(userId);
  const hours = patch.hours ?? current.hours;
  const sessionMinutes = patch.sessionMinutes ?? current.sessionMinutes;
  const row = await prisma.workHours.upsert({
    where: { userId },
    create: { userId, hours, sessionMinutes },
    update: { hours, sessionMinutes },
  });
  return { hours: (row.hours as WorkHoursDTO["hours"]) ?? {}, sessionMinutes: row.sessionMinutes };
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

/** Свободные окна на дату: шаблон дня минус снятые, с пометкой занятых. */
export function slotsFor(
  work: WorkHoursDTO,
  dateStr: string,
  takenISO: string[],
  overrides: Record<string, OverrideDTO>,
): SlotDTO[] {
  const day = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(day.getTime())) return [];
  const weekday = (day.getDay() + 6) % 7;
  const template = [...((work.hours ?? {})[weekday] ?? [])].sort((a, b) => a.t.localeCompare(b.t));
  const taken = new Set(takenISO.map((t) => new Date(t).getTime()));
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
    out.push({ start: iso, taken: taken.has(at.getTime()), fmt: ov?.fmt ?? slot.fmt ?? "online" });
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
  takenISO: string[],
  overrides: Record<string, OverrideDTO>,
): Record<string, "free" | "full"> {
  const out: Record<string, "free" | "full"> = {};
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const key = ymd(d);
    const slots = slotsFor(work, key, takenISO, overrides);
    if (slots.length === 0) continue;
    out[key] = slots.some((s) => !s.taken) ? "free" : "full";
  }
  return out;
}

/** Занятые времена психолога: всё, что не отменено. */
export async function takenTimes(userId: number, range?: Range): Promise<string[]> {
  // Занятость нужна только на горизонте календаря. Раньше читались все
  // записи за всё время — и попадали в память ради проверки двух месяцев.
  const appts = await prisma.appointment.findMany({
    where: {
      psychologistId: userId,
      status: { not: "cancelled" },
      ...(range ? { startsAt: { gte: range.from, lte: range.to } } : {}),
    },
    select: { startsAt: true },
  });
  return appts.map((a) => a.startsAt.toISOString());
}
