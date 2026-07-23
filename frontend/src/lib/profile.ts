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

/** Фото: основное из профиля важнее, иначе из Telegram, иначе null. */
export function displayPhoto(): string | null {
  const p = getPsyProfile();
  return p?.photos?.[0] || p?.photo || tgUser()?.photo_url || null;
}

// --- Онбординг и профиль психолога (localStorage, демо) ---

export type PsyProfile = {
  name: string;
  /** Старое поле, сохраняется для совместимости со старыми анкетами. */
  approach: string;
  primaryMethod: string;
  methods: string[];
  experienceYears: string;
  about: string;
  firstSession: string;
  education: string[];
  topics: string[];
  gender: "woman" | "man" | "unspecified";
  languages: string[];
  format: "online" | "offline" | "both";
  sessionPrice: number;
  location: {
    city: string;
    district: string;
    metro: string;
    address: string;
    publicExactAddress: boolean;
  };
  photo: string | null;        // совместимость; дублирует photos[0]
  photos: string[];            // до 3 фото, первое — основное
  sessionMinutes: number;      // длительность сессии
  tg: string;                  // ник в Telegram для связи (без @)
  specialistType: string;      // психолог / психотерапевт / психиатр / коуч …
  links: { kind: LinkKind; url: string }[]; // сайт и соцсети
  style: string;               // стиль работы: мягкий / структурный / активный …
  quote: string;               // короткая цитата от первого лица для карточки
  avoids: string[];            // темы, с которыми не работает
  status: "review" | "approved";
};

export type LinkKind = "site" | "telegram" | "instagram" | "vk" | "youtube";
export const LINK_META: Record<LinkKind, { label: string; icon: import("@/components/icons").IconName }> = {
  site: { label: "Сайт", icon: "compass" },
  telegram: { label: "Telegram", icon: "spark" },
  instagram: { label: "Instagram", icon: "heart" },
  vk: { label: "ВКонтакте", icon: "users" },
  youtube: { label: "YouTube", icon: "video" },
};
export const SPECIALIST_TYPES = ["Психолог", "Психотерапевт", "Психиатр", "Клинический психолог", "Коуч", "Гештальт-терапевт"];
export const STYLE_OPTIONS = ["мягкий и поддерживающий", "структурный", "активный, с заданиями", "неспешный, глубинный", "тёплый и практичный", "бережный, пошаговый"];

/** Ник Telegram из привязанной учётки (без @). */
export function tgUsername(): string {
  return tgUser()?.username ?? "";
}

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
    const source = JSON.parse(raw) as Partial<PsyProfile> & { education?: string[] | string };
    const p = { ...EMPTY, ...source } as PsyProfile;
    // миграция: образование могло быть строкой
    if (typeof source.education === "string") {
      const s = source.education.trim();
      p.education = s ? [s] : [];
    }
    if (!Array.isArray(p.education)) p.education = [];
    // миграция: одиночное фото → массив photos
    if (!Array.isArray(p.photos)) p.photos = p.photo ? [p.photo] : [];
    if (typeof p.sessionMinutes !== "number") p.sessionMinutes = 50;
    if (typeof p.sessionPrice !== "number") p.sessionPrice = 3500;
    if (typeof p.tg !== "string") p.tg = "";
    p.primaryMethod = p.primaryMethod || p.approach || "";
    p.approach = p.primaryMethod;
    if (!Array.isArray(p.methods)) p.methods = p.primaryMethod ? [p.primaryMethod] : [];
    if (p.primaryMethod && !p.methods.includes(p.primaryMethod)) p.methods = [p.primaryMethod, ...p.methods];
    if (!Array.isArray(p.languages) || !p.languages.length) p.languages = ["русский"];
    if (!Array.isArray(p.topics)) p.topics = [];
    if (!(["online", "offline", "both"] as const).includes(p.format)) p.format = "online";
    if (!(["woman", "man", "unspecified"] as const).includes(p.gender)) p.gender = "unspecified";
    p.location = { ...EMPTY.location, ...(source.location ?? {}) };
    return p;
  } catch {
    return null;
  }
}

const EMPTY: PsyProfile = {
  name: "", approach: "", primaryMethod: "", methods: [], experienceYears: "", about: "", firstSession: "",
  education: [], topics: [], gender: "unspecified", languages: ["русский"], format: "online", sessionPrice: 3500,
  location: { city: "", district: "", metro: "", address: "", publicExactAddress: false },
  photo: null, photos: [], sessionMinutes: 50, tg: "", specialistType: "Психолог", links: [], style: "", quote: "", avoids: [], status: "review",
};

// Мержим с текущим — можно сохранять по частям (онбординг и правки в кабинете).
export function savePsyProfile(patch: Partial<PsyProfile>) {
  const cur = getPsyProfile();
  const profile: PsyProfile = {
    ...EMPTY,
    ...cur,
    ...patch,
    location: { ...EMPTY.location, ...(cur?.location ?? {}), ...(patch.location ?? {}) },
    status: patch.status ?? cur?.status ?? "review",
  };
  if (patch.primaryMethod !== undefined) profile.approach = patch.primaryMethod;
  else if (patch.approach !== undefined) profile.primaryMethod = patch.approach;
  if (profile.primaryMethod && !profile.methods.includes(profile.primaryMethod)) profile.methods = [profile.primaryMethod, ...profile.methods];
  // Основное фото — первое в массиве (совместимость со старым polем photo).
  if (patch.photos) profile.photo = patch.photos[0] ?? null;
  else if (patch.photo !== undefined) profile.photos = patch.photo ? [patch.photo, ...profile.photos.filter((x) => x !== patch.photo)].slice(0, 3) : profile.photos;
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
