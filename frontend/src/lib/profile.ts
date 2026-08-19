"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { toCurrency, type Currency } from "@/lib/money";
import { EMPTY_RULES, normalizeRules, type ProfileRules } from "@/lib/profile-rules";

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
  /** До трёх главных запросов: в карточке идут первыми и со звёздочкой. */
  topTopics: string[];
  gender: "woman" | "man" | "unspecified";
  languages: string[];
  /** Пустая строка — специалист ещё не выбрал формат приёма. */
  format: "online" | "offline" | "both" | "";
  sessionPrice: number;
  /** Валюта стоимости: рубли либо доллар/евро для специалистов вне России. */
  currency: Currency;
  location: {
    city: string;
    district: string;
    metro: string;
    address: string;
    publicExactAddress: boolean;
    /** Регион или страна — показывается в карточке рядом с часовым поясом. */
    region: string;
  };
  /** Часовой пояс специалиста (IANA), чтобы клиент понимал разницу во времени. */
  timezone: string;
  photo: string | null;        // совместимость; дублирует photos[0]
  photos: string[];            // до 3 фото, первое — основное
  sessionMinutes: number;      // длительность сессии
  tg: string;                  // ник в Telegram для связи (без @)
  /** Старое поле с одной специальностью — читаем для совместимости. */
  specialistType?: string;
  specialistTypes: string[];   // психолог / психотерапевт / психиатр / коуч …
  links: { kind: LinkKind; url: string }[]; // сайт и соцсети
  style: string;               // стиль работы: мягкий / структурный / активный …
  quote: string;               // короткая цитата от первого лица для карточки
  avoids: string[];            // темы, с которыми не работает
  /** Показывать ли в анкете счётчики платформы: клиенты, сессии, стаж. */
  showStats: boolean;
  /** Правила работы: формулировка + отмечено ли «показывать клиенту». */
  rules: ProfileRules;
  status: "review" | "approved";
};

export type LinkKind = "site" | "telegram" | "instagram" | "vk" | "youtube";
/** Сноска к Instagram — обязательная в России, поэтому живёт рядом с меткой. */
export const INSTAGRAM_NOTE = "* Instagram принадлежит Meta Platforms Inc. — организация признана экстремистской, её деятельность запрещена в России.";

/** Есть ли среди ссылок анкеты та, к которой нужна сноска. */
export const hasRestrictedLink = (links?: { kind: string }[]) => (links ?? []).some((l) => l.kind === "instagram");

export const LINK_META: Record<LinkKind, { label: string; icon: import("@/components/icons").IconName }> = {
  site: { label: "Сайт", icon: "compass" },
  telegram: { label: "Telegram", icon: "spark" },
  instagram: { label: "Instagram*", icon: "heart" },
  vk: { label: "ВКонтакте", icon: "users" },
  youtube: { label: "YouTube", icon: "video" },
};
const LINK_HOST: Record<LinkKind, string | null> = {
  site: null,
  telegram: "https://t.me/",
  instagram: "https://instagram.com/",
  vk: "https://vk.com/",
  youtube: "https://youtube.com/@",
};

/**
 * Адрес ссылки анкеты в виде, пригодном для перехода. Специалисты пишут их
 * как придётся: «@nick», «instagram.com/nick», «www.site.ru». Раньше карточка
 * в каталоге показывала только те, что начинались с http(s), — всё остальное
 * молча пропадало, хотя человек его заполнил. Здесь дописываем схему и
 * разворачиваем ник в адрес соцсети. Не разобрали — вернём null, и ссылка не
 * покажется, вместо того чтобы вести в никуда.
 */
export function normalizeLinkUrl(kind: string, raw: string): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  const host = LINK_HOST[kind as LinkKind] ?? null;
  const handle = value.replace(/^@/, "");
  // Домен узнаём по точке до первого слэша: «t.me/nick» — адрес, «nick» — ник.
  const looksLikeDomain = /^[^\s/]+\.[a-zа-я]{2,}(\/|$)/i.test(value);
  if (looksLikeDomain) return `https://${value.replace(/^\/+/, "")}`;
  if (host && /^[\w.\-]+$/.test(handle)) return `${host}${handle}`;
  return null;
}

export const SPECIALIST_TYPES = ["Психолог", "Психотерапевт", "Психиатр", "Клинический психолог", "Коуч", "Гештальт-терапевт"];
export const STYLE_OPTIONS = ["мягкий и поддерживающий", "структурный", "активный, с заданиями", "неспешный, глубинный", "тёплый и практичный", "бережный, пошаговый"];

/** Ник Telegram из привязанной учётки (без @). */
export function tgUsername(): string {
  return tgUser()?.username ?? "";
}

const KEY_ONBOARDED = "bereg_onboarded";
const KEY_PROFILE = "bereg_psy_profile";
const EVENT = "bereg-profile-change";
/** Анкета сохранена в базе: слушателям пора перечитать то, что от неё зависит. */
export const PROFILE_SYNCED = "bereg-profile-synced";

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return true; // SSR: не мигаем онбордингом
  return localStorage.getItem(KEY_ONBOARDED) === "1";
}

export function completeOnboarding() {
  localStorage.setItem(KEY_ONBOARDED, "1");
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * Знакомство пройдено — это известно из базы: согласие на обработку данных
 * даётся на его последнем шаге и больше нигде. Сама отметка живёт только в
 * localStorage, поэтому на втором устройстве (Telegram на компьютере) человека
 * вели через знакомство заново, а вместе с ним — и через выбор роли.
 */
export function markOnboardedFromServer() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(KEY_ONBOARDED) === "1") return;
  completeOnboarding();
}

// Знакомство запускается заново — и только оно. Анкету профиля не трогаем:
// человек просил показать онбординг, а не стереть заполненные данные.
export function resetOnboarding() {
  localStorage.removeItem(KEY_ONBOARDED);
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
    if (typeof p.sessionMinutes !== "number") p.sessionMinutes = 0;
    if (typeof p.sessionPrice !== "number") p.sessionPrice = 0;
    p.currency = toCurrency(p.currency);
    if (typeof p.timezone !== "string") p.timezone = "";
    if (typeof p.tg !== "string") p.tg = "";
    p.primaryMethod = p.primaryMethod || p.approach || "";
    p.approach = p.primaryMethod;
    if (!Array.isArray(p.methods)) p.methods = p.primaryMethod ? [p.primaryMethod] : [];
    if (p.primaryMethod && !p.methods.includes(p.primaryMethod)) p.methods = [p.primaryMethod, ...p.methods];
    if (!Array.isArray(p.languages)) p.languages = [];
    if (!Array.isArray(p.topics)) p.topics = [];
    // Отмеченным остаётся только то, что выбрано в запросах: снял запрос —
    // звёздочка уходит вместе с ним, а не висит на пропавшей теме.
    if (!Array.isArray(p.topTopics)) p.topTopics = [];
    p.topTopics = p.topTopics.filter((topic) => p.topics.includes(topic)).slice(0, 3);
    if (!(["online", "offline", "both", ""] as const).includes(p.format)) p.format = "";
    if (!(["woman", "man", "unspecified"] as const).includes(p.gender)) p.gender = "unspecified";
    p.location = { ...EMPTY.location, ...(source.location ?? {}) };
    // Счётчики платформы включает сам специалист: у новичка нули в карточке
    // работают против него, поэтому по умолчанию их нет.
    if (typeof p.showStats !== "boolean") p.showStats = false;
    p.rules = normalizeRules(source.rules);
    return p;
  } catch {
    return null;
  }
}

// Анкета заводится полностью пустой: ни языка, ни формата, ни цены заранее.
// Иначе прогресс стартовал с 38%, а специалист не глядя выкладывал в каталог
// чужие умолчания — 3500 ₽ за 50 минут онлайн.
const EMPTY: PsyProfile = {
  name: "", approach: "", primaryMethod: "", methods: [], experienceYears: "", about: "", firstSession: "",
  education: [], topics: [], topTopics: [], gender: "unspecified", languages: [], format: "", sessionPrice: 0, currency: "RUB",
  location: { city: "", district: "", metro: "", address: "", publicExactAddress: false, region: "" },
  timezone: "",
  photo: null, photos: [], sessionMinutes: 0, tg: "", specialistTypes: [], links: [], style: "", quote: "", avoids: [],
  showStats: false, rules: EMPTY_RULES, status: "review",
};

// Мержим с текущим — можно сохранять по частям (онбординг и правки в кабинете).
export function savePsyProfile(patch: Partial<PsyProfile>) {
  const cur = getPsyProfile();
  const profile: PsyProfile = {
    ...EMPTY,
    ...cur,
    ...patch,
    location: { ...EMPTY.location, ...(cur?.location ?? {}), ...(patch.location ?? {}) },
    rules: normalizeRules({ ...(cur?.rules ?? {}), ...(patch.rules ?? {}) }),
    status: patch.status ?? cur?.status ?? "review",
  };
  if (patch.primaryMethod !== undefined) profile.approach = patch.primaryMethod;
  else if (patch.approach !== undefined) profile.primaryMethod = patch.approach;
  if (profile.primaryMethod && !profile.methods.includes(profile.primaryMethod)) profile.methods = [profile.primaryMethod, ...profile.methods];
  // Основное фото — первое в массиве (совместимость со старым polем photo).
  if (patch.photos) profile.photo = patch.photos[0] ?? null;
  else if (patch.photo !== undefined) profile.photos = patch.photo ? [patch.photo, ...profile.photos.filter((x) => x !== patch.photo)].slice(0, 3) : profile.photos;
  writeLocal(profile);
  queuePush(cur, profile);
}

function writeLocal(profile: PsyProfile) {
  try {
    localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
  } catch {
    // Квота localStorage кончилась — обычно на фото. Раньше падала вся запись
    // вместе с исключением наружу, и анкета переставала сохраняться совсем:
    // человек видел, что фото «не грузится». Сохраняем без фото — сами файлы
    // всё равно уезжают на сервер и вернутся оттуда при следующей сверке.
    try {
      localStorage.setItem(KEY_PROFILE, JSON.stringify({ ...profile, photos: profile.photos.slice(0, 1), photo: profile.photos[0] ?? null }));
    } catch {
      try { localStorage.setItem(KEY_PROFILE, JSON.stringify({ ...profile, photos: [], photo: null })); } catch { /* хранилище недоступно */ }
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

type ServerProfile = Partial<PsyProfile> & {
  status?: string;
  rejectReason?: string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Анкета из базы — она и есть правда. Локально уступают все поля, кроме тех,
 * что человек только что поменял на этом устройстве и которые ещё не доехали
 * до сервера: их сервер про свою копию просто не знает.
 */
function applyServerProfile(row: ServerProfile) {
  const cur = getPsyProfile();
  const next = {
    ...EMPTY,
    ...cur,
    ...row,
    location: { ...EMPTY.location, ...(cur?.location ?? {}), ...(row.location ?? {}) },
    rules: normalizeRules(row.rules ?? cur?.rules),
    status: toLocalStatus(row.status),
  } as PsyProfile & Record<string, unknown>;
  for (const [key, value] of Object.entries(pending)) next[key] = value;
  next.approach = next.primaryMethod || next.approach;
  next.primaryMethod = next.approach;
  if (!Array.isArray(next.photos)) next.photos = next.photo ? [next.photo] : [];
  next.photo = next.photos[0] ?? null;
  if (JSON.stringify(next) === JSON.stringify(cur)) return;
  writeLocal(next);
}

// В демо анкета живёт только в браузере, в бою источник правды — база, а
// localStorage остаётся кэшем: он рисует анкету до ответа сервера.
const LIVE = process.env.NEXT_PUBLIC_DEMO !== "1";

// Что решает не человек, а сервер: статус модерации и её следы.
const SERVER_OWNED = new Set(["status", "rejectReason", "submittedAt", "updatedAt"]);

// На сервер уезжают только изменённые поля. Форма сохраняет анкету целиком на
// каждый затихший ввод, и раньше полный снимок (вместе с фото на мегабайты)
// затирал в базе всё, что человек успел поправить со второго устройства.
let pending: Record<string, unknown> = {};
let flushTimer: number | null = null;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function queuePush(prev: PsyProfile | null, next: PsyProfile) {
  if (!LIVE || typeof window === "undefined") return;
  let changed = false;
  for (const key of Object.keys(next) as (keyof PsyProfile)[]) {
    if (SERVER_OWNED.has(key)) continue;
    if (prev && same(prev[key], next[key])) continue;
    pending[key] = next[key];
    changed = true;
  }
  if (changed) scheduleFlush(800);
}

function scheduleFlush(delay: number) {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => { flushTimer = null; void flushProfile(); }, delay);
}

async function flushProfile() {
  const body = pending;
  pending = {};
  if (!Object.keys(body).length) return;
  try {
    const row = await apiFetch<ServerProfile | null>("/profile", { method: "PATCH", body: JSON.stringify(body) });
    if (row) applyServerProfile(row);
    // Анкета доехала до базы — значит и карточка в каталоге уже другая.
    // Открытые списки должны перечитать её, а не ждать истечения кэша.
    window.dispatchEvent(new CustomEvent(PROFILE_SYNCED));
  } catch {
    // Гость и клиент анкеты не имеют — 401 тут норма. Поля возвращаем в
    // очередь, но не поверх того, что человек успел поправить следом.
    pending = { ...body, ...pending };
    scheduleFlush(5000);
  }
}

/** Статус модерации ставит сервер; локально держим только эти два значения. */
export const toLocalStatus = (status: unknown): PsyProfile["status"] => (status === "approved" ? "approved" : "review");

/** Когда анкету последний раз сверяли с базой. */
let lastServerSync = 0;
let syncing = false;

/**
 * Тянет анкету из базы в локальный кэш. `force` — когда ждать нельзя:
 * вкладку открыли заново, а на другом устройстве анкету уже поправили.
 */
export function refreshProfile(force = false) {
  if (!LIVE || typeof window === "undefined" || syncing) return;
  if (!force && Date.now() - lastServerSync < 20_000) return;
  syncing = true;
  lastServerSync = Date.now();
  apiFetch<ServerProfile | null>("/profile")
    .then((row) => { if (row) applyServerProfile(row); })
    .catch(() => {})
    .finally(() => { syncing = false; });
}

/** Решение модерации пришло другим путём — подтягиваем его в локальную анкету. */
export function applyServerStatus(status: unknown) {
  const cur = getPsyProfile();
  if (!cur || cur.status === toLocalStatus(status)) return;
  savePsyProfile({ status: toLocalStatus(status) });
}

export function useProfile(): PsyProfile | null {
  const [p, setP] = useState<PsyProfile | null>(null);
  useEffect(() => {
    setP(getPsyProfile());
    const onChange = () => setP(getPsyProfile());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  // Анкета приезжает из базы: на новом устройстве её в браузере нет, а правки
  // со второго устройства и решение модерации иначе не доедут. Возврат на
  // вкладку — отдельный повод сверить: телефон мог пролежать в кармане день.
  useEffect(() => {
    refreshProfile();
    const onVisible = () => { if (document.visibilityState === "visible") refreshProfile(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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

/**
 * Главные запросы анкеты: отмеченные звёздочкой, не больше трёх и только те,
 * что остались в списке запросов. Ими подписана миниатюра карточки — и в
 * каталоге, и в предпросмотре анкеты.
 */
export const topTopicsOf = (p: { topics?: string[]; topTopics?: string[] } | null | undefined): string[] =>
  (p?.topTopics ?? []).filter((topic) => (p?.topics ?? []).includes(topic)).slice(0, 3);
