// Смена шаблона недели не должна затирать дни, которые правили руками.
// Психолог убрал окна на конкретных датах, потом поменял график — новые часы
// применяются вперёд, а тронутые даты остаются такими, какими он их оставил.
// Способ: перед сменой шаблона «прибиваем» такой день его же окнами —
// разовыми правками, которые от шаблона уже не зависят.

import { parseYmd, weekdayOf, zoneYmd, zonedTime } from "@/lib/zone";

export type PinFormat = "online" | "offline";
export type PinSlot = { t: string; d: number; fmt: PinFormat };
export type PinHours = { hours: Record<number, PinSlot[]>; sessionMinutes: number };
export type PinOverride = { removed?: boolean; fmt?: PinFormat; added?: boolean; dur?: number };
/** Правка, которую нужно записать, чтобы день пережил смену шаблона. */
export type PinWrite = { iso: string; removed: boolean; fmt: PinFormat | null; added: boolean; dur: number | null };
/** Окно шаблона на конкретную дату. */
export type PinTemplateSlot = { iso: string; fmt: PinFormat; dur: number };

/** Шаблон недели в сравнимом виде: порядок дней и окон не должен влиять. */
function canon(hours: Record<number, PinSlot[]> | null | undefined): string {
  const out: [number, string[]][] = [];
  for (const [key, list] of Object.entries(hours ?? {})) {
    const day = Number(key);
    if (!Number.isFinite(day) || !Array.isArray(list) || !list.length) continue;
    out.push([day, list.map((s) => `${s.t}|${s.d}|${s.fmt ?? "online"}`).sort()]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return JSON.stringify(out);
}

export const sameHours = (a: Record<number, PinSlot[]> | null | undefined, b: Record<number, PinSlot[]> | null | undefined) =>
  canon(a) === canon(b);

/** Окна шаблона на дату — только будущие: прошедшие всё равно никому не видны. */
export function templateSlots(work: PinHours, dateStr: string, now = Date.now()): PinTemplateSlot[] {
  const date = parseYmd(dateStr);
  if (!date) return [];
  const session = work.sessionMinutes || 50;
  const out: PinTemplateSlot[] = [];
  for (const slot of (work.hours ?? {})[weekdayOf(dateStr)] ?? []) {
    const [hh, mm] = slot.t.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    const at = zonedTime(date.y, date.m, date.d, hh, mm);
    if (at.getTime() < now) continue;
    out.push({ iso: at.toISOString(), fmt: slot.fmt ?? "online", dur: slot.d || session });
  }
  return out;
}

/**
 * Что записать на одну тронутую дату. `before` — окна старого шаблона на неё,
 * `after` — нового, `overrides` — уже существующие правки этой даты.
 */
export function pinDay(
  before: PinTemplateSlot[],
  after: PinTemplateSlot[],
  overrides: Record<string, PinOverride>,
  session = 50,
): PinWrite[] {
  // Как день выглядит прямо сейчас: шаблон минус снятое плюс разовое.
  const effective = new Map<string, { fmt: PinFormat; dur: number }>();
  for (const slot of before) {
    const ov = overrides[slot.iso];
    if (ov?.removed) continue;
    effective.set(slot.iso, { fmt: ov?.fmt ?? slot.fmt, dur: slot.dur });
  }
  for (const [iso, ov] of Object.entries(overrides)) {
    if (!ov.added || ov.removed) continue;
    effective.set(iso, { fmt: ov.fmt ?? "online", dur: ov.dur ?? session });
  }

  const writes: PinWrite[] = [];
  // Окна дня становятся разовыми: шаблон им больше не указ.
  for (const [iso, slot] of effective) {
    if (overrides[iso]?.added) continue;
    writes.push({ iso, removed: false, fmt: slot.fmt, added: true, dur: slot.dur });
  }
  // Всё, что принёс бы новый шаблон сверх этого, на такой дате закрыто.
  for (const slot of after) {
    if (effective.has(slot.iso)) continue;
    if (overrides[slot.iso]?.removed) continue;
    writes.push({ iso: slot.iso, removed: true, fmt: overrides[slot.iso]?.fmt ?? null, added: false, dur: null });
  }
  return writes;
}

/**
 * Все правки, которые нужно записать перед сменой шаблона. Тронутой считается
 * дата, на которой уже есть хоть одна правка, — именно её и не трогаем.
 */
export function pinManualDays(
  before: PinHours,
  after: PinHours,
  overrides: Record<string, PinOverride>,
  now = Date.now(),
): PinWrite[] {
  if (sameHours(before.hours, after.hours)) return [];
  const byDate = new Map<string, Record<string, PinOverride>>();
  for (const [iso, ov] of Object.entries(overrides)) {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime()) || at.getTime() < now) continue;
    const key = zoneYmd(at);
    const bucket = byDate.get(key) ?? {};
    bucket[iso] = ov;
    byDate.set(key, bucket);
  }
  const writes: PinWrite[] = [];
  for (const [date, dayOverrides] of byDate) {
    writes.push(...pinDay(
      templateSlots(before, date, now),
      templateSlots(after, date, now),
      dayOverrides,
      before.sessionMinutes || 50,
    ));
  }
  return writes;
}
