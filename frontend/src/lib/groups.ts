import { apiFetch } from "@/lib/api";

export type GroupKind = "group" | "pair";

export type GroupMember = {
  id: number;
  clientId: number | null;
  name: string;
  status: "active" | "left";
  photo?: string | null;
};

export type Group = {
  id: number;
  title: string;
  kind: GroupKind;
  capacity: number;
  note: string;
  status: "active" | "archived";
  createdAt: string;
  members: GroupMember[];
};

export const KIND_LABEL: Record<GroupKind, string> = { group: "Группа", pair: "Пара" };

export const activeMembers = (g: Group) => g.members.filter((m) => m.status === "active");
export const seatsLeft = (g: Group) => Math.max(0, g.capacity - activeMembers(g).length);

export const listGroups = () => apiFetch<Group[]>("/groups");
export const getGroup = (id: number) => apiFetch<Group>(`/groups/${id}`);

export const createGroup = (input: { title: string; kind: GroupKind; capacity?: number }) =>
  apiFetch<Group>("/groups", { method: "POST", body: JSON.stringify(input) });

export const updateGroup = (id: number, patch: Partial<Pick<Group, "title" | "capacity" | "note" | "status">>) =>
  apiFetch<Group>(`/groups/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteGroup = (id: number) => apiFetch<void>(`/groups/${id}`, { method: "DELETE" });

export const addMembers = (id: number, clientIds: number[]) =>
  apiFetch<Group>(`/groups/${id}/members`, { method: "POST", body: JSON.stringify({ clientIds }) });

export const removeMember = (id: number, memberId: number) =>
  apiFetch<Group>(`/groups/${id}/members?memberId=${memberId}`, { method: "DELETE" });
