import { apiFetch } from "@/lib/api";

export type GroupKind = "group" | "pair";

export type GroupMember = {
  id: number;
  clientId: number | null;
  name: string;
  status: "active" | "left";
  photo?: string | null;
};

export type Attendance = { memberId: number; present: boolean };

export type MeetFormat = "online" | "offline";

export type GroupMeeting = {
  id: number;
  startsAt: string;
  durationMin: number;
  status: "planned" | "done" | "cancelled";
  note: string;
  /** Пусто — формат как у группы. */
  format?: MeetFormat | null;
  place?: string | null;
  attendance: Attendance[];
};

export type GroupTask = {
  id: number;
  text: string;
  dueAt: string | null;
  status: "open" | "done";
  createdAt: string;
};

export type Group = {
  id: number;
  title: string;
  kind: GroupKind;
  capacity: number;
  /** Приватная заметка ведущего. */
  note: string;
  /** Что видят участники: правила, о чём группа, что взять с собой. */
  about: string;
  format: MeetFormat;
  place: string;
  resourceUrl: string;
  remind24h: boolean;
  remind2h: boolean;
  status: "active" | "archived";
  createdAt: string;
  members: GroupMember[];
  meetings: GroupMeeting[];
  tasks: GroupTask[];
};

export const FORMAT_LABEL: Record<MeetFormat, string> = { online: "Онлайн", offline: "Очно" };

/** Формат встречи: своё значение, иначе как у группы. */
export const meetFormat = (g: Group, m: GroupMeeting): MeetFormat => m.format ?? g.format;
export const meetPlace = (g: Group, m: GroupMeeting): string => m.place ?? g.place;

export const KIND_LABEL: Record<GroupKind, string> = { group: "Группа", pair: "Пара" };

export const activeMembers = (g: Group) => g.members.filter((m) => m.status === "active");
export const seatsLeft = (g: Group) => Math.max(0, g.capacity - activeMembers(g).length);

const byTime = (a: GroupMeeting, b: GroupMeeting) => +new Date(a.startsAt) - +new Date(b.startsAt);
const alive = (m: GroupMeeting) => m.status !== "cancelled";

/** Встречи цикла по порядку — по ним считается «сессия 3 из 8». */
export const cycle = (g: Group) => g.meetings.filter(alive).sort(byTime);

export const nextMeeting = (g: Group, now = Date.now()): GroupMeeting | null =>
  cycle(g).find((m) => +new Date(m.startsAt) + m.durationMin * 60_000 > now) ?? null;

/** Номер встречи в цикле, считая с единицы. */
export const meetingNo = (g: Group, meeting: GroupMeeting) => cycle(g).findIndex((m) => m.id === meeting.id) + 1;

/** Встреча уже началась — значит её пора отмечать. */
export const isOver = (m: GroupMeeting, now = Date.now()) => +new Date(m.startsAt) <= now;

export const marked = (m: GroupMeeting) => m.attendance.length > 0;
export const presentCount = (m: GroupMeeting) => m.attendance.filter((a) => a.present).length;

/** На скольких из уже отмеченных встреч был этот участник. */
export function memberStats(g: Group, memberId: number) {
  const done = cycle(g).filter((m) => isOver(m) && marked(m));
  const been = done.filter((m) => m.attendance.some((a) => a.memberId === memberId && a.present)).length;
  return { been, of: done.length };
}

const DAY = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

/** «сегодня, 19:00» / «вт, 26 авг · 19:00» — как время подписано в «Сессиях». */
export function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((+new Date(d.toDateString()) - +new Date(now.toDateString())) / 86_400_000);
  if (days === 0) return `сегодня, ${time}`;
  if (days === 1) return `завтра, ${time}`;
  if (days === -1) return `вчера, ${time}`;
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return `${DAY[d.getDay()]}, ${date} · ${time}`;
}

export const listGroups = () => apiFetch<Group[]>("/groups");
export const getGroup = (id: number) => apiFetch<Group>(`/groups/${id}`);

export const createGroup = (input: { title: string; kind: GroupKind; capacity?: number }) =>
  apiFetch<Group>("/groups", { method: "POST", body: JSON.stringify(input) });

export type GroupPatch = Partial<Pick<Group, "title" | "capacity" | "note" | "about" | "format" | "place" | "resourceUrl" | "remind24h" | "remind2h" | "status">>;

export const updateGroup = (id: number, patch: GroupPatch) =>
  apiFetch<Group>(`/groups/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteGroup = (id: number) => apiFetch<void>(`/groups/${id}`, { method: "DELETE" });

export const addMembers = (id: number, clientIds: number[]) =>
  apiFetch<Group>(`/groups/${id}/members`, { method: "POST", body: JSON.stringify({ clientIds }) });

export const removeMember = (id: number, memberId: number) =>
  apiFetch<Group>(`/groups/${id}/members?memberId=${memberId}`, { method: "DELETE" });

/** Одна встреча или цикл: `repeatWeeks` — сколько раз повторить по той же неделе. */
export const planMeetings = (id: number, input: { startsAt: string; durationMin: number; repeatWeeks: number }) =>
  apiFetch<Group>(`/groups/${id}/meetings`, { method: "POST", body: JSON.stringify(input) });

export const markAttendance = (id: number, meetingId: number, attendance: Attendance[]) =>
  apiFetch<Group>(`/groups/${id}/meetings?meetingId=${meetingId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "done", attendance }),
  });

export const cancelMeeting = (id: number, meetingId: number) =>
  apiFetch<Group>(`/groups/${id}/meetings?meetingId=${meetingId}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });

export const deleteMeeting = (id: number, meetingId: number) =>
  apiFetch<Group>(`/groups/${id}/meetings?meetingId=${meetingId}`, { method: "DELETE" });

export const addTask = (id: number, input: { text: string; dueAt?: string | null }) =>
  apiFetch<Group>(`/groups/${id}/tasks`, { method: "POST", body: JSON.stringify(input) });

export const toggleTask = (id: number, taskId: number, status: GroupTask["status"]) =>
  apiFetch<Group>(`/groups/${id}/tasks?taskId=${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) });

export const removeTask = (id: number, taskId: number) =>
  apiFetch<Group>(`/groups/${id}/tasks?taskId=${taskId}`, { method: "DELETE" });

/** Посещаемость по отмеченным встречам: сколько отметок «был» из всех. */
export function attendanceStats(groups: Group[]) {
  let present = 0;
  let missed = 0;
  let held = 0;
  let ahead = 0;
  for (const g of groups) {
    for (const m of cycle(g)) {
      if (isOver(m) && marked(m)) {
        held += 1;
        present += m.attendance.filter((a) => a.present).length;
        missed += m.attendance.filter((a) => !a.present).length;
      } else if (!isOver(m)) ahead += 1;
    }
  }
  const total = present + missed;
  return { present, missed, held, ahead, total, rate: total ? Math.round((present / total) * 100) : 0 };
}
