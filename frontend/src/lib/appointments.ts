import { apiFetch } from "@/lib/api";

export type Appointment = {
  id: number;
  startsAt: string;
  durationMin: number;
  status: "scheduled" | "done" | "cancelled";
  note: string;
  client: { id: number; name: string };
};

export const listAppointments = (clientId?: number) =>
  apiFetch<Appointment[]>(`/appointments${clientId ? `?clientId=${clientId}` : ""}`);

export const createAppointment = (input: {
  clientId: number;
  startsAt: string;
  durationMin?: number;
}) => apiFetch<Appointment>("/appointments", { method: "POST", body: JSON.stringify(input) });

export const updateAppointment = (
  id: number,
  patch: Partial<{ status: Appointment["status"]; startsAt: string; durationMin: number; note: string }>,
) => apiFetch<Appointment>(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteAppointment = (id: number) =>
  apiFetch<void>(`/appointments/${id}`, { method: "DELETE" });
