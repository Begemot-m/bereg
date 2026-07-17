import { apiFetch } from "@/lib/api";

export type ClientStatus = "therapy" | "new" | "paused";
export type HwStatus = "assigned" | "doing" | "done";

export type Client = {
  id: number;
  name: string;
  contact: string | null;
  note: string;
  status: ClientStatus;
  sessionsDone: number;
  nextAt: string | null;
  hwTotal: number;
  hwDone: number;
  createdAt: string;
  updatedAt: string;
};

export type Homework = { id: number; clientId: number; text: string; status: HwStatus; sentAt: string };
export type Mood = { date: string; mood: number };

export const STATUS_LABEL: Record<ClientStatus, string> = {
  therapy: "В терапии",
  new: "Новый",
  paused: "Пауза",
};

export const HW_LABEL: Record<HwStatus, string> = {
  assigned: "Назначено",
  doing: "Выполняется",
  done: "Выполнено",
};

export const listClients = () => apiFetch<Client[]>("/clients");
export const getClient = (id: number) => apiFetch<Client>(`/clients/${id}`);

export const createClient = (name: string, contact: string) =>
  apiFetch<Client>("/clients", { method: "POST", body: JSON.stringify({ name, contact }) });

export const updateClient = (
  id: number,
  patch: Partial<Pick<Client, "name" | "contact" | "note" | "status">>,
) => apiFetch<Client>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteClient = (id: number) => apiFetch<void>(`/clients/${id}`, { method: "DELETE" });

export const listHomework = (clientId: number) => apiFetch<Homework[]>(`/clients/${clientId}/homework`);

export const sendHomework = (clientId: number, text: string) =>
  apiFetch<Homework>(`/clients/${clientId}/homework`, { method: "POST", body: JSON.stringify({ text }) });

export const updateHomework = (id: number, patch: Partial<Pick<Homework, "text" | "status">>) =>
  apiFetch<Homework>(`/homework/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const listMoods = (clientId: number) => apiFetch<Mood[]>(`/clients/${clientId}/moods`);

export type MyBooking = { id: number; psyName: string; startsAt: string; durationMin: number; format: "online" | "offline" };
export const listMyBookings = () => apiFetch<MyBooking[]>("/my/appointments");
