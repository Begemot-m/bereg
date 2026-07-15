import { apiFetch } from "@/lib/api";
import type { MyBooking } from "@/lib/clients";

export const bookSlot = (psyName: string, startsAt: string, durationMin = 60) =>
  apiFetch<MyBooking>("/my/appointments", { method: "POST", body: JSON.stringify({ psyName, startsAt, durationMin }) });

export const rescheduleMyBooking = (id: number, startsAt: string) =>
  apiFetch<MyBooking>(`/my/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ startsAt }) });

export const cancelMyBooking = (id: number) =>
  apiFetch<void>(`/my/appointments/${id}`, { method: "DELETE" });
