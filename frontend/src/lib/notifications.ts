import { apiFetch } from "@/lib/api";
import type { Role } from "@/lib/role";

export type Notif = { id: number; forRole: "psychologist" | "client"; kind: string; text: string; createdAt: string; read: boolean };

const roleParam = (role: Role): "psychologist" | "client" => (role === "psychologist" ? "psychologist" : "client");

export const getNotifications = (role: Role) => apiFetch<Notif[]>(`/notifications?role=${roleParam(role)}`);
export const markNotificationsRead = (role: Role) => apiFetch<{ ok: true }>("/notifications/read", { method: "POST", body: JSON.stringify({ role: roleParam(role) }) });
