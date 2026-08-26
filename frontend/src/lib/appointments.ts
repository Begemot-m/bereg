import { apiFetch } from "@/lib/api";

export type ApptFormat = "online" | "offline";

export type Appointment = {
  id: number;
  startsAt: string;
  durationMin: number;
  status: "scheduled" | "done" | "cancelled";
  note: string;
  format: ApptFormat;
  /// Пусто — клиент записался сам и ждёт ответа специалиста.
  confirmedAt?: string | null;
  client: { id: number; name: string; photo?: string | null };
};

export const awaitsConfirm = (a: Appointment) => a.status === "scheduled" && !a.confirmedAt;

/** Всё, у чего есть начало и длительность: запись специалиста и запись клиента. */
type Timed = { startsAt: string; durationMin: number };

/** Момент, когда встреча заканчивается: начало плюс длительность. */
export const apptEnd = (a: Timed) => +new Date(a.startsAt) + a.durationMin * 60_000;

/**
 * Время встречи вышло целиком — только с этого момента она состоялась.
 *
 * Раньше «прошедшей» считалась любая начавшаяся встреча. В день сессии, ровно
 * в её час, запись пропадала с главной и из карточки клиента — у обеих сторон
 * сразу, — а в календаре тут же подписывалась «состоялась». Считаем по концу:
 * пока идёт — она в расписании, после конца — состоявшаяся работа.
 */
export const hasEnded = (a: Timed, now = Date.now()) => apptEnd(a) <= now;

/** Встреча идёт прямо сейчас. */
export const isRunning = (a: Timed, now = Date.now()) => +new Date(a.startsAt) <= now && !hasEnded(a, now);

/** Встреча, которую ещё предстоит провести: не отменена и не закончилась. */
export const isAhead = (a: Timed & { status: Appointment["status"] }, now = Date.now()) =>
  a.status === "scheduled" && !hasEnded(a, now);

export const confirmAppointment = (id: number) =>
  apiFetch<Appointment>(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ confirm: true }) });

export const listAppointments = (clientId?: number) =>
  apiFetch<Appointment[]>(`/appointments${clientId ? `?clientId=${clientId}` : ""}`);

export const createAppointment = (input: {
  clientId: number;
  startsAt: string;
  durationMin?: number;
  format?: ApptFormat;
}) => apiFetch<Appointment>("/appointments", { method: "POST", body: JSON.stringify(input) });

export const updateAppointment = (
  id: number,
  patch: Partial<{ status: Appointment["status"]; startsAt: string; durationMin: number; note: string; format: ApptFormat }>,
) => apiFetch<Appointment>(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteAppointment = (id: number) =>
  apiFetch<void>(`/appointments/${id}`, { method: "DELETE" });
