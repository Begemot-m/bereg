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

/**
 * Запись в ленте группы. `post` — объявление ведущего, `event` — то, что
 * система записала сама: перенос, отмена, новая встреча, новый участник.
 * И то и другое уходит всем участникам сразу, как сообщение в пати.
 */
export type GroupPost = {
  id: number;
  kind: "post" | "event";
  text: string;
  createdAt: string;
  /** Скольким участникам ушло на момент отправки. */
  reach: number;
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
  /** Миниатюра: `ico:<id>` из готового набора или data-URL загруженной картинки. */
  avatar: string;
  /** Правила круга — их видят участники. */
  rules: string;
  /** Стоимость участия свободным текстом. */
  price: string;
  remind24h: boolean;
  remind2h: boolean;
  status: "active" | "archived";
  createdAt: string;
  members: GroupMember[];
  meetings: GroupMeeting[];
  tasks: GroupTask[];
  posts: GroupPost[];
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

/**
 * Время встречи вышло целиком — её пора отмечать. Считаем по концу, а не по
 * началу: иначе ровно в свой час встреча уезжала из расписания в прошедшие и
 * тут же просила «отметьте, кто был» — прямо посреди самой встречи.
 */
export const isOver = (m: GroupMeeting, now = Date.now()) => +new Date(m.startsAt) + m.durationMin * 60_000 <= now;

/** Встреча идёт прямо сейчас. */
export const isLive = (m: GroupMeeting, now = Date.now()) => +new Date(m.startsAt) <= now && !isOver(m, now);

export const marked = (m: GroupMeeting) => m.attendance.length > 0;
export const presentCount = (m: GroupMeeting) => m.attendance.filter((a) => a.present).length;

/** На скольких из уже отмеченных встреч был этот участник. */
export function memberStats(g: Group, memberId: number) {
  const done = cycle(g).filter((m) => isOver(m) && marked(m));
  const been = done.filter((m) => m.attendance.some((a) => a.memberId === memberId && a.present)).length;
  return { been, of: done.length, missed: missStreak(g, memberId) };
}

/**
 * Сколько последних отмеченных встреч человек пропустил подряд. Считаем именно
 * подряд: три пропуска, размазанные по полугоду, — это жизнь, а три подряд —
 * точка отсева, ради которой ярлык и нужен.
 */
export function missStreak(g: Group, memberId: number) {
  const done = cycle(g).filter((m) => isOver(m) && marked(m));
  let streak = 0;
  for (let i = done.length - 1; i >= 0; i -= 1) {
    const row = done[i].attendance.find((a) => a.memberId === memberId);
    // Участника не было в списке отметок — он тогда ещё не состоял в группе.
    if (!row) break;
    if (row.present) break;
    streak += 1;
  }
  return streak;
}

/** Три пропуска подряд — участник отваливается, и ведущему стоит это увидеть. */
export const isFading = (g: Group, memberId: number) => missStreak(g, memberId) >= 3;

/** Группы, в которых числится карточка клиента. */
export const groupsOfClient = (groups: Group[], clientId: number) =>
  groups.filter((g) => g.status === "active" && g.members.some((m) => m.clientId === clientId && m.status === "active"));

/** Участник группы, отвечающий карточке клиента. */
export const memberOfClient = (g: Group, clientId: number) =>
  g.members.find((m) => m.clientId === clientId && m.status === "active") ?? null;

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

/**
 * Насколько скоро: «сегодня» / «завтра» / «через 3 дня». Рядом с датой это
 * отвечает на вопрос, ради которого ведущий вообще открыл раздел.
 */
export function untilLabel(iso: string, now = new Date()): string {
  const days = Math.round((+new Date(new Date(iso).toDateString()) - +new Date(now.toDateString())) / 86_400_000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days < 7) return `через ${days} ${days % 10 === 1 && days % 100 !== 11 ? "день" : days % 10 >= 2 && days % 10 <= 4 ? "дня" : "дней"}`;
  const weeks = Math.round(days / 7);
  return `через ${weeks} ${weeks === 1 ? "неделю" : weeks < 5 ? "недели" : "недель"}`;
}

export const listGroups = () => apiFetch<Group[]>("/groups");
export const getGroup = (id: number) => apiFetch<Group>(`/groups/${id}`);

export const createGroup = (input: { title: string; kind: GroupKind; capacity?: number }) =>
  apiFetch<Group>("/groups", { method: "POST", body: JSON.stringify(input) });

export type GroupPatch = Partial<Pick<Group, "title" | "capacity" | "note" | "about" | "format" | "place" | "resourceUrl" | "avatar" | "rules" | "price" | "remind24h" | "remind2h" | "status">>;

export const updateGroup = (id: number, patch: GroupPatch) =>
  apiFetch<Group>(`/groups/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteGroup = (id: number) => apiFetch<void>(`/groups/${id}`, { method: "DELETE" });

/** Ссылка на набор: одна на группу, без срока. */
export const groupInviteToken = (id: number) => apiFetch<{ token: string }>(`/groups/${id}/invite`);

/** Приход по ссылке набора: карточка клиента и место в составе заводятся сами. */
export const joinGroup = (token: string) =>
  apiFetch<{ ok: boolean; groupId: number; clientId: number; joined: boolean }>("/groups/join", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

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

/** Перенос встречи: новое время уходит всем участникам сразу. */
export const moveMeeting = (id: number, meetingId: number, input: { startsAt: string; durationMin: number }) =>
  apiFetch<Group>(`/groups/${id}/meetings?meetingId=${meetingId}`, { method: "PATCH", body: JSON.stringify(input) });

export const cancelMeeting = (id: number, meetingId: number) =>
  apiFetch<Group>(`/groups/${id}/meetings?meetingId=${meetingId}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });

export const deleteMeeting = (id: number, meetingId: number) =>
  apiFetch<Group>(`/groups/${id}/meetings?meetingId=${meetingId}`, { method: "DELETE" });

export const addTask = (id: number, input: { text: string; dueAt?: string | null }) =>
  apiFetch<Group>(`/groups/${id}/tasks`, { method: "POST", body: JSON.stringify(input) });

export const toggleTask = (id: number, taskId: number, status: GroupTask["status"]) =>
  apiFetch<Group>(`/groups/${id}/tasks?taskId=${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) });

/** Правка текста задания — как у домашки клиента. */
export const editTask = (id: number, taskId: number, text: string) =>
  apiFetch<Group>(`/groups/${id}/tasks?taskId=${taskId}`, { method: "PATCH", body: JSON.stringify({ text }) });

export const removeTask = (id: number, taskId: number) =>
  apiFetch<Group>(`/groups/${id}/tasks?taskId=${taskId}`, { method: "DELETE" });

/** Объявление всем участникам разом. */
export const addPost = (id: number, text: string) =>
  apiFetch<Group>(`/groups/${id}/posts`, { method: "POST", body: JSON.stringify({ text }) });

export const removePost = (id: number, postId: number) =>
  apiFetch<Group>(`/groups/${id}/posts?postId=${postId}`, { method: "DELETE" });

/** Настроение участников для диаграмм динамики — одним запросом на группу. */
export type GroupMood = { memberId: number; name: string; photo?: string | null; rows: { date: string; mood: number }[] };

export const groupMoods = (id: number) => apiFetch<GroupMood[]>(`/groups/${id}/mood`);

/**
 * Динамика состояний участников: средний балл настроения по неделям.
 * `weeks` — сколько недель назад считать, свежая справа.
 */
export function moodTrend(rows: { mood: number; date: string }[], weeks = 6, now = Date.now()) {
  const week = 7 * 86_400_000;
  return Array.from({ length: weeks }, (_, i) => {
    const to = now - (weeks - 1 - i) * week;
    const from = to - week;
    const inWeek = rows.filter((r) => { const t = +new Date(r.date); return t > from && t <= to; });
    const avg = inWeek.length ? inWeek.reduce((s, r) => s + r.mood, 0) / inWeek.length : null;
    return { avg, count: inWeek.length };
  });
}

/** Куда идёт настроение: сравниваем свежую половину окна с прошлой. */
export function trendDelta(points: { avg: number | null }[]) {
  const vals = points.map((p) => p.avg).filter((v): v is number => v !== null);
  if (vals.length < 2) return 0;
  const half = Math.ceil(vals.length / 2);
  const older = vals.slice(0, vals.length - half);
  const fresh = vals.slice(vals.length - half);
  if (!older.length) return 0;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  return Math.round((mean(fresh) - mean(older)) * 10) / 10;
}

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
