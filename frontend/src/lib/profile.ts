"use client";

import { useEffect, useState } from "react";

// --- Пользователь из Telegram (initDataUnsafe достаточно для прототипа) ---

type TgUser = { first_name?: string; last_name?: string; username?: string; id?: number; photo_url?: string };

export function tgUser(): TgUser | null {
  if (typeof window === "undefined") return null;
  // @ts-expect-error — глобал Telegram задаёт telegram-web-app.js
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

/** Имя для приветствия: из ТГ, иначе из профиля психолога, иначе нейтрально. */
export function displayName(): string {
  const u = tgUser();
  if (u?.first_name) return u.first_name;
  const p = getPsyProfile();
  if (p?.name) return p.name.split(" ")[0];
  return "коллега";
}

/** Фото: загруженное вручную важнее, иначе из Telegram, иначе null. */
export function displayPhoto(): string | null {
  return getPsyProfile()?.photo || tgUser()?.photo_url || null;
}

// --- Онбординг и профиль психолога (localStorage, демо) ---

export type PsyProfile = {
  name: string;
  approach: string;
  experienceYears: string;
  about: string;
  education: string[];
  topics: string[];
  photo: string | null;
  status: "review" | "approved";
};

const KEY_ONBOARDED = "bereg_onboarded";
const KEY_PROFILE = "bereg_psy_profile";
const EVENT = "bereg-profile-change";

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return true; // SSR: не мигаем онбордингом
  return localStorage.getItem(KEY_ONBOARDED) === "1";
}

export function completeOnboarding() {
  localStorage.setItem(KEY_ONBOARDED, "1");
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function resetOnboarding() {
  localStorage.removeItem(KEY_ONBOARDED);
  localStorage.removeItem(KEY_PROFILE);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getPsyProfile(): PsyProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_PROFILE);
    if (!raw) return null;
    const p = JSON.parse(raw) as PsyProfile;
    // миграция: образование могло быть строкой
    if (typeof (p as unknown as { education: unknown }).education === "string") {
      const s = (p as unknown as { education: string }).education.trim();
      p.education = s ? [s] : [];
    }
    if (!Array.isArray(p.education)) p.education = [];
    return p;
  } catch {
    return null;
  }
}

const EMPTY: PsyProfile = { name: "", approach: "", experienceYears: "", about: "", education: [], topics: [], photo: null, status: "review" };

// Мержим с текущим — можно сохранять по частям (онбординг и правки в кабинете).
export function savePsyProfile(patch: Partial<Omit<PsyProfile, "status">>) {
  const cur = getPsyProfile();
  const profile: PsyProfile = { ...EMPTY, ...cur, ...patch, status: cur?.status ?? "review" };
  localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useProfile(): PsyProfile | null {
  const [p, setP] = useState<PsyProfile | null>(null);
  useEffect(() => {
    setP(getPsyProfile());
    const onChange = () => setP(getPsyProfile());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return p;
}

export function useOnboarded(): [boolean | null, () => void] {
  // null = ещё не знаем (до маунта), чтобы не мигать
  const [state, setState] = useState<boolean | null>(null);

  useEffect(() => {
    setState(isOnboarded());
    const onChange = () => setState(isOnboarded());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  return [state, completeOnboarding];
}
