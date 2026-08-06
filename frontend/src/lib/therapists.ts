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

// Имена из записей считаются прикреплёнными, пока их не открепили вручную.
// Одна и та же склейка нужна и главной, и «Терапии» — иначе разделы расходятся.
export function mergeWithBookings(store: TherapistStore, bookingNames: string[]): TherapistStore {
  const list = [...new Set([...store.list, ...bookingNames.filter((name) => !store.removed.includes(name))])];
  const active = store.active && list.includes(store.active) ? store.active : list[0] ?? null;
  return { ...store, list, active };
}

// Открепить терапевта: уходит из списка и попадает в «удалённые», чтобы его
// не вернула склейка с записями.
export function detachTherapist(name: string): TherapistStore {
  const store = loadTherapists();
  const list = store.list.filter((item) => item !== name);
  const next: TherapistStore = {
    list,
    removed: [...new Set([...store.removed, name])],
    active: store.active === name ? list[0] ?? null : store.active,
  };
  saveTherapists(next);
  return next;
}
