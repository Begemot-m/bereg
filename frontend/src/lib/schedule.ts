import { apiFetch } from "@/lib/api";

export type SlotFormat = "online" | "offline";
export type WorkSlot = { t: string; d: number; fmt: SlotFormat };
export type WorkHours = {
  hours: Record<number, WorkSlot[]>;
  sessionMinutes: number;
  /** За сколько дней до встречи клиент уже не может её отменить. 0 — без ограничения. */
  cancelLockDays: number;
};

export type Slot = { start: string; taken: boolean; fmt: SlotFormat };

export const getWorkHours = () => apiFetch<WorkHours>("/work-hours");
export const saveWorkHours = (patch: Partial<WorkHours>) =>
  apiFetch<WorkHours>("/work-hours", { method: "PATCH", body: JSON.stringify(patch) });

// dateStr = YYYY-MM-DD. psyId — чьи окна смотрим: без него это своё расписание,
// с ним — расписание специалиста, к которому записывается клиент.
export const getSlots = (dateStr: string, psyId?: number | null) =>
  apiFetch<Slot[]>(`/slots?date=${dateStr}${psyId ? `&psy=${psyId}` : ""}`);

export type DayAvail = "free" | "full";
export const getMonthAvailability = (psyId?: number | null) =>
  apiFetch<Record<string, DayAvail>>(`/month-availability${psyId ? `?psy=${psyId}` : ""}`);

// Корректировки конкретных дат поверх шаблона
export type SlotOverride = { removed?: boolean; fmt?: SlotFormat };
export const getOverrides = () => apiFetch<Record<string, SlotOverride>>("/overrides");
export const setOverride = (iso: string, patch: SlotOverride) =>
  apiFetch<Record<string, SlotOverride>>("/overrides", { method: "PATCH", body: JSON.stringify({ iso, ...patch }) });

export function ymdLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
