import { apiFetch } from "@/lib/api";

export type ApptFormat = "online" | "offline";

export type Appointment = {
  id: number;
  startsAt: string;
  durationMin: number;
  status: "scheduled" | "done" | "cancelled";
  note: string;
  format: ApptFormat;
  client: { id: number; name: string };
};

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
