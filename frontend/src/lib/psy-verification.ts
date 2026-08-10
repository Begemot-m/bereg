"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { DEMO } from "@/lib/demo";
import { applyServerStatus } from "@/lib/profile";

export type PsyStatus = "none" | "draft" | "review" | "approved" | "rejected";

export type Verification = {
  status: PsyStatus;
  rejectReason: string | null;
  submittedAt: string | null;
  /** Демо: номер заявки в очереди админки — по нему подтягиваем решение модератора. */
  applicationId?: number | null;
};

export type VerificationForm = {
  fullName: string;
  education: string;
  method: string;
  experienceYears: string;
  publicLink: string;
  about: string;
};

// Заявка на размещение в каталоге. Диплом храним как data-URL: в демо нет
// файлового хранилища, а модератору нужно увидеть сам документ, а не имя файла.
export type DiplomaFile = { name: string; type: string; size: number; dataUrl: string };

export type CatalogSubmission = {
  name: string;
  education: string;
  method: string;
  experienceYears: number;
  sessionPrice: number;
  city: string;
  format: string;
  publicLink: string;
  about: string;
  photo: string | null;
  profilePercent: number;
  diploma: DiplomaFile | null;
};

// Порог, ниже которого заявку не принимаем: неполная карточка в каталоге
// бесполезна и клиенту, и самому специалисту.
export const CATALOG_MIN_PERCENT = 60;

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

// Верификация нужна ровно для каталога: своих клиентов психолог ведёт с
// первого дня, а чужих людей платформа отправляет только к проверенным.
export const isInCatalog = (status: PsyStatus) => status === "approved";

const KEY = "psy_verification";

function demoRead(): Verification {
  if (typeof window === "undefined") return { status: "none", rejectReason: null, submittedAt: null };
  const raw = localStorage.getItem(KEY);
  // Раньше пустой ключ означал «уже подтверждён», и верификация выглядела
  // пройденной сама собой. Проверку проходят, а не получают по умолчанию:
  // новый психолог начинает с «не подана».
  if (!raw) return { status: "none", rejectReason: null, submittedAt: null };
  return JSON.parse(raw) as Verification;
}

function demoWrite(next: Verification) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

// Решение по заявке принимает модератор в админке — таймера «через шесть
// секунд одобрено» больше нет: он и делал верификацию формальностью. В демо
// цепочка та же, что в проде: отправил документы → заявка в админке → владелец
// одобрил или вернул на правки → статус здесь поменялся.
function demoSyncWithQueue(cur: Verification): Verification {
  if (cur.status !== "review" || !cur.applicationId) return cur;
  let queue: { userId: number; status: string; rejectReason: string | null }[] = [];
  try { queue = JSON.parse(localStorage.getItem(DEMO_QUEUE_KEY) ?? "[]"); } catch { return cur; }
  const row = queue.find((item) => item.userId === cur.applicationId);
  if (!row || row.status === "review") return cur;
  const next: Verification = {
    ...cur,
    status: row.status === "approved" ? "approved" : "rejected",
    rejectReason: row.rejectReason ?? null,
  };
  demoWrite(next);
  return next;
}

export function useVerification() {
  return useQuery<Verification>({
    queryKey: ["psy-verification"],
    queryFn: async () => {
      if (DEMO) {
        const next = demoSyncWithQueue(demoRead());
        applyServerStatus(next.status);
        return next;
      }
      const row = await apiFetch<{ status?: string; rejectReason?: string | null; submittedAt?: string | null } | null>("/profile");
      if (!row) return { status: "none", rejectReason: null, submittedAt: null };
      // Решение модератора живёт в базе; локальной анкете о нём никто не
      // сообщал, и она навсегда оставалась «на проверке».
      applyServerStatus(row.status);
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

const DEMO_QUEUE_KEY = "bereg_demo_psy_queue";

// В демо админки нет сервера — кладём заявку в ту же очередь, которую читает
// /admin. Диплом может не поместиться в localStorage: тогда сохраняем заявку
// без файла, но с пометкой, вместо того чтобы потерять её целиком.
function pushDemoApplication(sub: CatalogSubmission): number {
  const applicationId = Date.now() % 100000;
  const row = {
    userId: applicationId,
    name: sub.name || "Без имени",
    username: null,
    email: null,
    registeredAt: new Date().toISOString(),
    status: "review",
    rejectReason: null,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    method: sub.method,
    experienceYears: sub.experienceYears,
    sessionPrice: sub.sessionPrice,
    city: sub.city,
    format: sub.format,
    education: sub.education,
    publicLink: sub.publicLink,
    about: sub.about,
    photo: sub.photo,
    profilePercent: sub.profilePercent,
    diploma: sub.diploma,
  };
  const write = (value: unknown[]) => localStorage.setItem(DEMO_QUEUE_KEY, JSON.stringify(value));
  let queue: unknown[] = [];
  try { queue = JSON.parse(localStorage.getItem(DEMO_QUEUE_KEY) ?? "[]") as unknown[]; } catch { queue = []; }
  try {
    write([row, ...queue]);
  } catch {
    write([{ ...row, diploma: sub.diploma ? { ...sub.diploma, dataUrl: "" } : null }, ...queue]);
  }
  return applicationId;
}

export function useSubmitCatalogVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sub: CatalogSubmission) => {
      const next: Verification = { status: "review", rejectReason: null, submittedAt: new Date().toISOString() };
      if (DEMO) {
        const applicationId = pushDemoApplication(sub);
        const withId = { ...next, applicationId };
        demoWrite(withId);
        return withId;
      }
      await apiFetch("/profile/verification", { method: "POST", body: JSON.stringify(sub) });
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(["psy-verification"], next);
      qc.invalidateQueries({ queryKey: ["admin-verification"] });
    },
  });
}

export function resetVerification() {
  demoWrite({ status: "none", rejectReason: null, submittedAt: null, applicationId: null });
}
