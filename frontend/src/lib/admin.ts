"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { DEMO } from "@/lib/demo";

export type PsyApplication = {
  userId: number;
  name: string;
  username: string | null;
  email: string | null;
  registeredAt: string;
  status: string;
  rejectReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  method: string;
  experienceYears: number;
  sessionPrice: number;
  city: string;
  format: string;
  education: string;
  publicLink: string;
  about: string;
  // Приходят только из заявки на каталог: старые записи их не имеют.
  photo?: string | null;
  profilePercent?: number;
  diploma?: { name: string; type: string; size: number; dataUrl: string } | null;
  /** Документы из хранилища: метаданные, файл открывается роутом по id. */
  documents?: { id: number; kind: string; name: string; mime: string; size: number }[];
};

export type VerificationQueue = { queue: PsyApplication[]; recent: PsyApplication[] };

export type Stats = {
  users: { total: number; newWeek: number; psychologists: number; blocked: number; activeWeek: number };
  subscriptions: { paid: number; granted: number; pending: number };
  usage: { clients: number; appointments: number; appointmentsMonth: number };
  support: { open: number };
  verification: { review: number; approved: number };
};

export type SeriesRow = {
  day: string; registrations: number; appointments: number; payments: number; revenue: number;
};

export type Series = {
  days: number;
  from: string;
  rows: SeriesRow[];
  totals: { registrations: number; appointments: number; payments: number; revenue: number };
  /** Раньше этой даты платежи не сохранялись вовсе — не «продаж не было». */
  paymentsSince: string | null;
};

export type FunnelRow = { key: string; label: string; n: number; ofFirst: number; ofPrev: number };

export type Funnels = { psychologist: FunnelRow[]; client: FunnelRow[] };

export type SupportRow = {
  id: number; topic: string; text: string; contact: string | null;
  createdAt: string; handledAt: string | null;
  userId: number | null; name: string; username: string | null; email: string | null;
};

export type SupportInbox = { open: SupportRow[]; handled: SupportRow[] };

export type AuditRow = {
  id: string; action: string; entity: string | null; entityId: string | null;
  ip: string | null; meta: unknown; createdAt: string;
  actorId: number | null; actor: string;
};

export type UserRow = {
  id: number; name: string; username: string | null; email: string | null;
  roles: string[]; isAdmin: boolean; blocked: boolean; deleted: boolean;
  createdAt: string; pro: boolean; proUntil: string | null; proGranted: boolean;
  clients: number; appointments: number;
};

/** Психолог всегда остаётся и клиентом: своя терапия у него не отбирается. */
const rolesFor = (role: string) => (role === "psychologist" ? ["client", "psychologist"] : ["client"]);

const DEMO_USERS: UserRow[] = [
  {
    id: 1, name: "Матвей", username: "mmgorba", email: "m.m.gorba@gmail.com",
    roles: rolesFor("psychologist"), isAdmin: true, blocked: false, deleted: false,
    createdAt: "2026-06-01T10:00:00.000Z", pro: true, proUntil: "2027-06-01T10:00:00.000Z",
    proGranted: true, clients: 4, appointments: 26,
  },
  {
    id: 101, name: "Анна Ковалёва", username: "anna_kov", email: "anna@example.com",
    roles: rolesFor("psychologist"), isAdmin: false, blocked: false, deleted: false,
    createdAt: "2026-07-28T09:10:00.000Z", pro: true, proUntil: "2026-09-01T00:00:00.000Z",
    proGranted: false, clients: 9, appointments: 41,
  },
  {
    id: 102, name: "Игорь Демьянов", username: null, email: null,
    roles: rolesFor("psychologist"), isAdmin: false, blocked: false, deleted: false,
    createdAt: "2026-08-02T18:40:00.000Z", pro: false, proUntil: null,
    proGranted: false, clients: 0, appointments: 0,
  },
  {
    id: 203, name: "Марина", username: "marina_s", email: null,
    roles: rolesFor("client"), isAdmin: false, blocked: false, deleted: false,
    createdAt: "2026-07-15T12:00:00.000Z", pro: false, proUntil: null,
    proGranted: false, clients: 0, appointments: 6,
  },
];

const KEY = "bereg_demo_psy_queue";

const DEMO_SEED: PsyApplication[] = [
  {
    userId: 101,
    name: "Анна Ковалёва",
    username: "anna_kov",
    email: "anna@example.com",
    registeredAt: "2026-07-28T09:10:00.000Z",
    status: "review",
    rejectReason: null,
    submittedAt: "2026-08-01T11:20:00.000Z",
    reviewedAt: null,
    method: "КПТ",
    experienceYears: 7,
    sessionPrice: 4500,
    city: "Москва",
    format: "both",
    education: "МГУ, факультет психологии, 2016. Переподготовка по КПТ, АКПП, 2019.",
    publicLink: "https://t.me/anna_therapy",
    about: "Работаю с тревогой и выгоранием. Веду супервизию раз в две недели.",
  },
  {
    userId: 102,
    name: "Игорь Демьянов",
    username: null,
    email: null,
    registeredAt: "2026-08-02T18:40:00.000Z",
    status: "review",
    rejectReason: null,
    submittedAt: "2026-08-03T08:05:00.000Z",
    reviewedAt: null,
    method: "Гештальт",
    experienceYears: 2,
    sessionPrice: 3000,
    city: "Казань",
    format: "online",
    education: "Курс гештальт-терапии, 1 ступень",
    publicLink: "",
    about: "Пары и отношения.",
  },
];

function demoRead(): PsyApplication[] {
  if (typeof window === "undefined") return DEMO_SEED;
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    localStorage.setItem(KEY, JSON.stringify(DEMO_SEED));
    return DEMO_SEED;
  }
  return JSON.parse(raw) as PsyApplication[];
}

const SUPPORT_KEY = "bereg_demo_support";
const ROLES_KEY = "bereg_demo_roles";

const SUPPORT_SEED: SupportRow[] = [
  {
    id: 1, topic: "billing", userId: 101, name: "Анна Ковалёва", username: "anna_kov",
    email: "anna@example.com", contact: null,
    text: "Оплатила PRO, деньги списались, а в кабинете всё ещё бесплатный тариф. Чек приложила в чат бота.",
    createdAt: "2026-08-03T07:40:00.000Z", handledAt: null,
  },
  {
    id: 2, topic: "bug", userId: null, name: "гость", username: null, email: null,
    contact: "t.me/marina_s",
    text: "Не могу войти по почте: письмо с кодом не приходит уже второй день.",
    createdAt: "2026-08-04T19:15:00.000Z", handledAt: null,
  },
  {
    id: 3, topic: "data", userId: 203, name: "Марина", username: "marina_s",
    email: null, contact: null,
    text: "Прошу удалить мои данные из карточки клиента у психолога.",
    createdAt: "2026-07-30T10:05:00.000Z", handledAt: "2026-07-30T12:20:00.000Z",
  },
];

const AUDIT_SEED: AuditRow[] = [
  {
    id: "a1", action: "admin.psy.approve", entity: "PsyProfile", entityId: "101",
    ip: "213.139.208.92", meta: {}, createdAt: "2026-08-04T09:12:00.000Z",
    actorId: 1, actor: "Матвей",
  },
  {
    id: "a2", action: "admin.grant_pro", entity: "Subscription", entityId: "101",
    ip: "213.139.208.92", meta: { days: 30, note: "выдано из админки" },
    createdAt: "2026-08-04T09:10:00.000Z", actorId: 1, actor: "Матвей",
  },
  {
    id: "a3", action: "consent.grant", entity: "Consent", entityId: "203",
    ip: null, meta: { kind: "data" }, createdAt: "2026-08-03T18:02:00.000Z",
    actorId: 203, actor: "Марина",
  },
  {
    id: "a4", action: "admin.block", entity: "User", entityId: "404",
    ip: "213.139.208.92", meta: {}, createdAt: "2026-08-01T14:30:00.000Z",
    actorId: 1, actor: "Матвей",
  },
  {
    id: "a5", action: "login", entity: "Session", entityId: "102",
    ip: null, meta: {}, createdAt: "2026-08-01T08:00:00.000Z",
    actorId: 102, actor: "Игорь Демьянов",
  },
];

function demoStore<T>(key: string, seed: T): T {
  if (typeof window === "undefined") return seed;
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw) as T;
}

function demoSupport(): SupportRow[] {
  return demoStore(SUPPORT_KEY, SUPPORT_SEED);
}

function demoRoles(): Record<string, string> {
  return demoStore<Record<string, string>>(ROLES_KEY, {});
}

export function useAdminStats() {
  return useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      if (DEMO) {
        const queue = demoRead().filter((a) => a.status === "review").length;
        return {
          users: { total: 128, newWeek: 11, psychologists: 34, blocked: 1, activeWeek: 47 },
          subscriptions: { paid: 12, granted: 3, pending: 2 },
          usage: { clients: 214, appointments: 963, appointmentsMonth: 187 },
          support: { open: demoSupport().filter((r) => !r.handledAt).length },
          verification: { review: queue, approved: 28 },
        };
      }
      return apiFetch<Stats>("/admin/stats");
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminUsers(q: string, page: number) {
  return useQuery<{ items: UserRow[]; total: number; pages: number }>({
    queryKey: ["admin-users", q, page],
    queryFn: async () => {
      if (DEMO) {
        const needle = q.trim().toLowerCase();
        const roles = demoRoles();
        const items = DEMO_USERS
          .map((u) => (roles[u.id] ? { ...u, roles: rolesFor(roles[u.id]) } : u))
          .filter((u) =>
            !needle ||
            u.name.toLowerCase().includes(needle) ||
            (u.username ?? "").toLowerCase().includes(needle) ||
            (u.email ?? "").toLowerCase().includes(needle),
          );
        return { items, total: items.length, pages: 1 };
      }
      return apiFetch(`/admin/users?q=${encodeURIComponent(q)}&page=${page}`);
    },
    retry: false,
  });
}

export type AdminUserAction = {
  grantPro?: { days: number; note?: string };
  revokePro?: boolean;
  blocked?: boolean;
  role?: "client" | "psychologist";
};

export function useUserAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: AdminUserAction }) => {
      if (DEMO) {
        if (body.role) {
          localStorage.setItem(ROLES_KEY, JSON.stringify({ ...demoRoles(), [id]: body.role }));
        }
        return;
      }
      await apiFetch(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}

export function useVerificationQueue() {
  return useQuery<VerificationQueue>({
    queryKey: ["admin-verification"],
    queryFn: async () => {
      if (DEMO) {
        const all = demoRead();
        return {
          queue: all.filter((a) => a.status === "review"),
          recent: all.filter((a) => a.status !== "review").slice(0, 10),
        };
      }
      return apiFetch<VerificationQueue>("/admin/verification");
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useReviewVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason?: string }) => {
      const body = reason ? { action: "reject", reason } : { action: "approve" };
      if (DEMO) {
        const next = demoRead().map((a) =>
          a.userId === userId
            ? {
                ...a,
                status: reason ? "rejected" : "approved",
                rejectReason: reason ?? null,
                reviewedAt: new Date().toISOString(),
              }
            : a,
        );
        localStorage.setItem(KEY, JSON.stringify(next));
        return;
      }
      await apiFetch(`/admin/verification/${userId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-verification"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}

// Демо-ряд должен быть похож на правду и не прыгать при каждом рендере:
// считаем по номеру дня, выходные проседают, к концу периода рост.
function demoSeries(days: number): Series {
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (days - 1));

  const rows: SeriesRow[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + i);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const wave = (i * 7919) % 11;
    const growth = 1 + i / days;
    const registrations = Math.max(0, Math.round((1 + wave / 4) * growth) - (weekend ? 1 : 0));
    const appointments = Math.max(0, Math.round((3 + wave) * growth) - (weekend ? 3 : 0));
    const payments = wave % 5 === 0 && !weekend ? 1 : 0;
    return {
      day: d.toISOString().slice(0, 10),
      registrations,
      appointments,
      payments,
      revenue: payments * 99000,
    };
  });

  const paidFrom = new Date(from);
  paidFrom.setUTCDate(paidFrom.getUTCDate() + Math.floor(days / 3));

  return {
    days,
    from: from.toISOString(),
    rows,
    totals: {
      registrations: rows.reduce((s, r) => s + r.registrations, 0),
      appointments: rows.reduce((s, r) => s + r.appointments, 0),
      payments: rows.reduce((s, r) => s + r.payments, 0),
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
    },
    paymentsSince: paidFrom.toISOString(),
  };
}

export function useSeries(days: number) {
  return useQuery<Series>({
    queryKey: ["admin-series", days],
    queryFn: async () => {
      if (DEMO) return demoSeries(days);
      return apiFetch<Series>(`/admin/series?days=${days}`);
    },
    staleTime: 60_000,
    retry: false,
  });
}

function demoFunnels(): Funnels {
  const rows = (steps: [string, string, number][]): FunnelRow[] => {
    const first = steps[0][2];
    return steps.map(([key, label, n], i) => {
      const prev = i === 0 ? first : steps[i - 1][2];
      return {
        key, label, n,
        ofFirst: first > 0 ? Math.round((n / first) * 100) : 0,
        ofPrev: prev > 0 ? Math.round((n / prev) * 100) : 0,
      };
    });
  };

  return {
    psychologist: rows([
      ["registered", "Регистрации", 64],
      ["profile", "Завели анкету", 31],
      ["submitted", "Подали на проверку", 22],
      ["approved", "Одобрены — в каталоге", 17],
      ["booked", "Первая запись", 9],
    ]),
    client: rows([
      ["registered", "Аккаунты клиентов", 48],
      ["booked", "Записались", 26],
      ["attended", "Сессия состоялась", 19],
      ["returned", "Пришли второй раз", 11],
    ]),
  };
}

export function useFunnels() {
  return useQuery<Funnels>({
    queryKey: ["admin-funnel"],
    queryFn: async () => {
      if (DEMO) return demoFunnels();
      return apiFetch<Funnels>("/admin/funnel");
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useSupportInbox() {
  return useQuery<SupportInbox>({
    queryKey: ["admin-support"],
    queryFn: async () => {
      if (DEMO) {
        const all = demoSupport();
        return {
          open: all.filter((r) => !r.handledAt),
          handled: all.filter((r) => r.handledAt).slice(0, 10),
        };
      }
      return apiFetch<SupportInbox>("/admin/support");
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useSupportAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reply, reopen }: { id: number; reply?: string; reopen?: boolean }) => {
      if (DEMO) {
        const next = demoSupport().map((r) =>
          r.id === id ? { ...r, handledAt: reopen ? null : new Date().toISOString() } : r,
        );
        localStorage.setItem(SUPPORT_KEY, JSON.stringify(next));
        return;
      }
      const body = reopen ? { action: "reopen" } : { action: "handle", ...(reply ? { reply } : {}) };
      await apiFetch(`/admin/support/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}

export function useAuditLog(action: string, page: number, enabled: boolean) {
  return useQuery<{ items: AuditRow[]; total: number; pages: number }>({
    queryKey: ["admin-audit", action, page],
    enabled,
    queryFn: async () => {
      if (DEMO) {
        const items = AUDIT_SEED.filter((r) => !action || r.action.startsWith(action));
        return { items, total: items.length, pages: 1 };
      }
      return apiFetch(`/admin/audit?action=${encodeURIComponent(action)}&page=${page}`);
    },
    retry: false,
  });
}
