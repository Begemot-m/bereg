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
export const CATALOG_MIN_PERCENT = 90;

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
  // Демо-психолог заходит с готовой практикой: у него уже есть клиенты и
  // сессии. Считать его неодобренным — значит молча запретить запись и
  // показать пустое приложение вместо продукта. Путь верификации щупается
  // через явный сброс в кабинете.
  if (!raw) return { status: "approved", rejectReason: null, submittedAt: null };
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

const DEMO_QUEUE_KEY = "bereg_demo_psy_queue";

// В демо админки нет сервера — кладём заявку в ту же очередь, которую читает
// /admin. Диплом может не поместиться в localStorage: тогда сохраняем заявку
// без файла, но с пометкой, вместо того чтобы потерять её целиком.
function pushDemoApplication(sub: CatalogSubmission) {
  const row = {
    userId: Date.now() % 100000,
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
}

export function useSubmitCatalogVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sub: CatalogSubmission) => {
      const next: Verification = { status: "review", rejectReason: null, submittedAt: new Date().toISOString() };
      if (DEMO) {
        demoWrite(next);
        pushDemoApplication(sub);
        return next;
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
  // Пишем статус явно, а не стираем ключ: пустой ключ означает «демо со
  // всеми правами», и сброс тогда ничего бы не сбросил.
  demoWrite({ status: "none", rejectReason: null, submittedAt: null });
}
