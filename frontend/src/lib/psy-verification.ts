"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { DEMO } from "@/lib/demo";

export type PsyStatus = "none" | "draft" | "review" | "approved" | "rejected";

export type Verification = {
  status: PsyStatus;
  rejectReason: string | null;
  submittedAt: string | null;
};

export type VerificationForm = {
  fullName: string;
  education: string;
  method: string;
  experienceYears: string;
  publicLink: string;
  about: string;
};

export const EMPTY_FORM: VerificationForm = {
  fullName: "",
  education: "",
  method: "",
  experienceYears: "",
  publicLink: "",
  about: "",
};

export const STATUS_LABEL: Record<PsyStatus, string> = {
  none: "Не подана",
  draft: "Черновик",
  review: "На проверке",
  approved: "Подтверждён",
  rejected: "Нужны правки",
};

// Пока анкета не одобрена, кабинет открыт целиком, но в каталог она не
// попадает и приглашать клиентов нельзя: между непроверенным человеком и
// чужой психикой должна стоять хотя бы одна дверь.
export const canTakeClients = (status: PsyStatus) => status === "approved";

const KEY = "psy_verification";

function demoRead(): Verification {
  if (typeof window === "undefined") return { status: "none", rejectReason: null, submittedAt: null };
  const raw = localStorage.getItem(KEY);
  if (!raw) return { status: "none", rejectReason: null, submittedAt: null };
  return JSON.parse(raw) as Verification;
}

function demoWrite(next: Verification) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

// Демо крутится без сервера, поэтому модерацию имитируем таймером: подал —
// через несколько секунд одобрено. Иначе экран «на проверке» не пощупать.
const DEMO_REVIEW_MS = 6000;

export function useVerification() {
  return useQuery<Verification>({
    queryKey: ["psy-verification"],
    queryFn: async () => {
      if (DEMO) {
        const cur = demoRead();
        if (cur.status === "review" && cur.submittedAt && Date.now() - new Date(cur.submittedAt).getTime() > DEMO_REVIEW_MS) {
          const next: Verification = { ...cur, status: "approved" };
          demoWrite(next);
          return next;
        }
        return cur;
      }
      const row = await apiFetch<{ status?: string; rejectReason?: string | null; submittedAt?: string | null } | null>("/profile");
      if (!row) return { status: "none", rejectReason: null, submittedAt: null };
      return {
        status: (row.status as PsyStatus) ?? "draft",
        rejectReason: row.rejectReason ?? null,
        submittedAt: row.submittedAt ?? null,
      };
    },
    refetchInterval: (query) => (query.state.data?.status === "review" ? 4000 : false),
    staleTime: 30_000,
    retry: false,
  });
}

export function useSubmitVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: VerificationForm) => {
      if (DEMO) {
        const next: Verification = { status: "review", rejectReason: null, submittedAt: new Date().toISOString() };
        demoWrite(next);
        return next;
      }
      await apiFetch("/profile/verification", { method: "POST", body: JSON.stringify(form) });
      return { status: "review", rejectReason: null, submittedAt: new Date().toISOString() } as Verification;
    },
    onSuccess: (next) => qc.setQueryData(["psy-verification"], next),
  });
}

export function resetVerification() {
  localStorage.removeItem(KEY);
}
