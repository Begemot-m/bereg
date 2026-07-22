"use client";

// Прикреплённые терапевты клиента: список + активный + удалённые вручную.
// Хранится на устройстве; каталог добавляет сюда, раздел «Терапия» читает.
export const THERAPISTS_KEY = "bereg_my_therapists_v1";

export type TherapistStore = { list: string[]; removed: string[]; active: string | null };

export function loadTherapists(): TherapistStore {
  const base: TherapistStore = { list: [], removed: [], active: null };
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(THERAPISTS_KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<TherapistStore>) };
  } catch { /* ignore */ }
  return base;
}

export function saveTherapists(store: TherapistStore) {
  try { localStorage.setItem(THERAPISTS_KEY, JSON.stringify(store)); } catch { /* ignore */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("bereg:therapists"));
}

// Прикрепить терапевта. Возвращает true, если добавили (false — уже был).
export function attachTherapist(name: string): boolean {
  const store = loadTherapists();
  const removed = store.removed.filter((n) => n !== name);
  if (store.list.includes(name)) { saveTherapists({ ...store, removed, active: store.active ?? name }); return false; }
  saveTherapists({ list: [...store.list, name], removed, active: store.active ?? name });
  return true;
}

export function isAttached(name: string): boolean {
  return loadTherapists().list.includes(name);
}
