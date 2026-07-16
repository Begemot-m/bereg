import { apiFetch } from "@/lib/api";

export type WorkHours = {
  hours: Record<number, string[]>;
  sessionMinutes: number;
};

export type Slot = { start: string; taken: boolean };

export const getWorkHours = () => apiFetch<WorkHours>("/work-hours");
export const saveWorkHours = (patch: Partial<WorkHours>) =>
  apiFetch<WorkHours>("/work-hours", { method: "PATCH", body: JSON.stringify(patch) });

// dateStr = YYYY-MM-DD; forClient=true → слоты специалиста для записи клиента
export const getSlots = (dateStr: string, forClient = false) =>
  apiFetch<Slot[]>(`/slots?date=${dateStr}${forClient ? "&psy=1" : ""}`);

export type DayAvail = "free" | "full";
export const getMonthAvailability = (forClient = false) =>
  apiFetch<Record<string, DayAvail>>(`/month-availability${forClient ? "?psy=1" : ""}`);

export function ymdLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
