import { apiFetch } from "@/lib/api";

export type ClientStatus = "therapy" | "new" | "paused";
export type HwStatus = "assigned" | "doing" | "done";
// Подключение клиента к своему профилю: none — карточку завёл психолог;
// invited — приглашение отправлено; joined — клиент вошёл и подключился (синхронизировано).
export type ClientLink = "none" | "invited" | "joined";

export type Client = {
  id: number;
  name: string;
  contact: string | null;
  note: string;
  status: ClientStatus;
  link: ClientLink;
  invitedAt: string | null;
  sessionsDone: number;
  hoursDone: number;
  nextAt: string | null;
  lastAt: string | null;
  hwTotal: number;
  hwDone: number;
  createdAt: string;
  updatedAt: string;
};

// Статус вычисляется автоматически по активности, не выставляется вручную.
export function derivedStatus(c: Pick<Client, "sessionsDone" | "nextAt" | "lastAt">): ClientStatus {
  if (c.sessionsDone === 0 && !c.nextAt) return "new";
  const recent = c.lastAt ? (Date.now() - new Date(c.lastAt).getTime()) / 86_400_000 <= 45 : false;
  if (c.nextAt || recent) return "therapy";
  return "paused";
}
export function statusReason(c: Pick<Client, "sessionsDone" | "nextAt" | "lastAt">): string {
  const s = derivedStatus(c);
  if (s === "new") return "Пока не было встреч";
  if (s === "therapy") return c.nextAt ? "Есть предстоящая сессия" : "Недавняя активность";
  return "Давно не было встреч";
}

export type Homework = { id: number; clientId: number; text: string; status: HwStatus; sentAt: string };
export type Mood = { date: string; mood: number; emotions?: string[] };

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

// Пригласить клиента подключить свой профиль (опционально обновив контакт).
export const inviteClient = (id: number, contact?: string) =>
  apiFetch<Client>(`/clients/${id}/invite`, { method: "POST", body: JSON.stringify(contact !== undefined ? { contact } : {}) });

export const LINK_LABEL: Record<ClientLink, string> = {
  none: "Не подключён",
  invited: "Приглашение отправлено",
  joined: "Профиль подключён",
};

// Контакт — телефон (цифры/скобки/дефисы), иначе ник Telegram.
export function isPhone(contact: string): boolean {
  return /^[+\d][\d\s()\-]{4,}$/.test(contact.trim());
}
export function formatContact(contact: string): string {
  const c = contact.trim();
  if (!c) return c;
  if (isPhone(c)) return c;
  return c.startsWith("@") ? c : `@${c}`;
}

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

export const deleteHomework = (id: number) =>
  apiFetch<{ ok: boolean }>(`/homework/${id}`, { method: "DELETE" });

export const listMoods = (clientId: number) => apiFetch<Mood[]>(`/clients/${clientId}/moods`);

export type MyBooking = { id: number; psyName: string; startsAt: string; durationMin: number; format: "online" | "offline" };
export const listMyBookings = () => apiFetch<MyBooking[]>("/my/appointments");
