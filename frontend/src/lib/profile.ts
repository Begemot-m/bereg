"use client";

import { useEffect, useState } from "react";

// --- Пользователь из Telegram (initDataUnsafe достаточно для прототипа) ---

type TgUser = { first_name?: string; last_name?: string; username?: string; id?: number };

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

// --- Онбординг и мини-профиль психолога (localStorage, демо) ---

export type PsyProfile = {
  name: string;
  approach: string;
  experienceYears: string;
  about: string;
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
    return raw ? (JSON.parse(raw) as PsyProfile) : null;
  } catch {
    return null;
  }
}

export function savePsyProfile(p: Omit<PsyProfile, "status">) {
  const profile: PsyProfile = { ...p, status: "review" };
  localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent(EVENT));
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
