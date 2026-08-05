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
};

export type VerificationQueue = { queue: PsyApplication[]; recent: PsyApplication[] };

export type Stats = {
  users: { total: number; newWeek: number; psychologists: number; blocked: number; activeWeek: number };
  subscriptions: { paid: number; granted: number; pending: number };
  usage: { clients: number; appointments: number; appointmentsMonth: number };
  support: { open: number };
  verification: { review: number; approved: number };
};

export type UserRow = {
  id: number; name: string; username: string | null; email: string | null;
  role: string; isAdmin: boolean; blocked: boolean; deleted: boolean;
  createdAt: string; pro: boolean; proUntil: string | null; proGranted: boolean;
  clients: number; appointments: number;
};

const DEMO_USERS: UserRow[] = [
  {
    id: 1, name: "Матвей", username: "mmgorba", email: "m.m.gorba@gmail.com",
    role: "psychologist", isAdmin: true, blocked: false, deleted: false,
    createdAt: "2026-06-01T10:00:00.000Z", pro: true, proUntil: "2027-06-01T10:00:00.000Z",
    proGranted: true, clients: 4, appointments: 26,
  },
  {
    id: 101, name: "Анна Ковалёва", username: "anna_kov", email: "anna@example.com",
    role: "psychologist", isAdmin: false, blocked: false, deleted: false,
    createdAt: "2026-07-28T09:10:00.000Z", pro: true, proUntil: "2026-09-01T00:00:00.000Z",
    proGranted: false, clients: 9, appointments: 41,
  },
  {
    id: 102, name: "Игорь Демьянов", username: null, email: null,
    role: "psychologist", isAdmin: false, blocked: false, deleted: false,
    createdAt: "2026-08-02T18:40:00.000Z", pro: false, proUntil: null,
    proGranted: false, clients: 0, appointments: 0,
  },
  {
    id: 203, name: "Марина", username: "marina_s", email: null,
    role: "client", isAdmin: false, blocked: false, deleted: false,
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
          support: { open: 2 },
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
        const items = DEMO_USERS.filter((u) =>
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

export function useUserAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: unknown }) => {
      if (DEMO) return;
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
