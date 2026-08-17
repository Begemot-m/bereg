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
