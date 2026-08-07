import { apiFetch } from "@/lib/api";
import type { MyBooking } from "@/lib/clients";

// psychologistId — то, чем запись живёт на сервере; psyName остаётся для
// демо-мока, который знает специалистов каталога только по имени.
// Длительность не навязываем: сервер берёт её из анкеты специалиста.
export const bookSlot = (psy: { id?: number; name: string }, startsAt: string, format: "online" | "offline" = "online") =>
  apiFetch<MyBooking>("/my/appointments", {
    method: "POST",
    body: JSON.stringify({ psychologistId: psy.id, psyName: psy.name, startsAt, format }),
  });

export const rescheduleMyBooking = (id: number, startsAt: string) =>
  apiFetch<MyBooking>(`/my/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ startsAt }) });

export const cancelMyBooking = (id: number) =>
  apiFetch<void>(`/my/appointments/${id}`, { method: "DELETE" });
