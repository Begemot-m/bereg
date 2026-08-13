"use client";

// Прикреплённые терапевты клиента: список + активный + открепленные вручную.
//
// Источник правды — база (`/my/therapists`). localStorage остался кэшем: он
// рисует раздел до ответа сервера и держит демо, где сервера нет вовсе.
// Раньше кэш был единственным хранилищем — на втором устройстве раздел
// «Терапия» открывался пустым, а специалист, прикреплённый из каталога,
// приходил без id, и записаться к нему было некуда.
export const THERAPISTS_KEY = "bereg_my_therapists_v1";

import { apiFetch } from "@/lib/api";
import { apiPsyToCatalogPsy, PSYS, type CatalogApiPsy, type Psy } from "@/lib/catalog";
import { displayName } from "@/lib/profile";

// Флаг читается напрямую из окружения, а не из lib/demo: мок импортирует
// ключ хранилища отсюда, и через `DEMO` получился бы цикл.
const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

// ids — имя специалиста → его userId. Без id запись на окно уходила бы «в
// никуда»: сервер спрашивает, к кому записываемся, а имя ему ни о чём не говорит.
//
// cards — карточка специалиста целиком, как в каталоге: фото, метод, цена,
// город, рейтинг. Раздел «Терапия» рисовал закреплённого терапевта из
// статического `PSYS`, а в бою он пуст — оставались буква вместо аватарки и
// пустые чипы. Теперь карточка приезжает с сервера вместе со списком.
export type TherapistStore = {
  list: string[];
  removed: string[];
  active: string | null;
  ids: Record<string, number>;
  cards: Record<number, Psy>;
};

export type TherapistLink = CatalogApiPsy & { active: boolean };

export function loadTherapists(): TherapistStore {
  const base: TherapistStore = { list: [], removed: [], active: null, ids: {}, cards: {} };
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

/** Ответ сервера ложится в кэш целиком: он и есть правда. */
function applyServer(links: TherapistLink[]): TherapistStore {
  const store = loadTherapists();
  const ids: Record<string, number> = { ...store.ids };
  const cards: Record<number, Psy> = { ...store.cards };
  for (const link of links) {
    ids[link.name] = link.id;
    cards[link.id] = apiPsyToCatalogPsy(link);
  }
  const next: TherapistStore = {
    ids,
    cards,
    list: links.map((l) => l.name),
    removed: store.removed.filter((name) => !links.some((l) => l.name === name)),
    active: links.find((l) => l.active)?.name ?? links[0]?.name ?? null,
  };
  saveTherapists(next);
  return next;
}

/** Подтянуть список из базы. В демо сервера нет — работает кэш. */
export async function syncTherapists(): Promise<TherapistStore> {
  if (DEMO) return loadTherapists();
  try {
    return applyServer(await apiFetch<TherapistLink[]>("/my/therapists"));
  } catch {
    return loadTherapists();
  }
}

/** Отказ «мест нет» приходит кодом 402 — его нельзя проглатывать как сбой сети. */
const notAccepting = (e: unknown) => e instanceof Error && e.message.includes("API 402");

async function pushLink(psyId: number, action: "attach" | "detach" | "active", name?: string) {
  // В демо сервера нет, но карточка у психолога появиться обязана: прикрепить
  // специалиста и не оказаться у него в клиентах — половина связи.
  if (DEMO) {
    if (action === "attach") {
      try {
        await apiFetch("/clients/from-therapy", { method: "POST", body: JSON.stringify({ clientName: displayName() }) });
      } catch (e) {
        // Мест у специалиста нет — откатываем прикрепление, иначе в разделе
        // осталась бы карточка терапевта, который клиента не ведёт.
        if (notAccepting(e) && name) detachTherapist(name);
      }
    }
    return;
  }
  if (!psyId) return;
  try {
    applyServer(await apiFetch<TherapistLink[]>("/my/therapists", {
      method: "PATCH",
      body: JSON.stringify({ psychologistId: psyId, action }),
    }));
  } catch (e) {
    if (notAccepting(e) && name) detachTherapist(name);
    /* иначе останемся на кэше — следующая синхронизация подтянет */
  }
}

// Прикрепить терапевта. Возвращает true, если добавили (false — уже был).
// card — карточка из каталога: кладём её в кэш сразу, чтобы раздел «Терапия»
// открылся с фото и чипами, не дожидаясь ответа сервера.
export function attachTherapist(name: string, psyId?: number, card?: Psy): boolean {
  const store = loadTherapists();
  const removed = store.removed.filter((n) => n !== name);
  const id = psyId ?? store.ids[name];
  const ids = id ? { ...store.ids, [name]: id } : store.ids;
  const cards = card && id ? { ...store.cards, [id]: card } : store.cards;
  const already = store.list.includes(name);
  saveTherapists(
    already
      ? { ...store, ids, cards, removed, active: store.active ?? name }
      : { ...store, ids, cards, list: [...store.list, name], removed, active: store.active ?? name },
  );
  if (id || DEMO) void pushLink(id ?? 0, "attach", name);
  return !already;
}

/** Кого раздел «Терапия» открывает по умолчанию. */
export function setActiveTherapist(name: string) {
  const store = loadTherapists();
  saveTherapists({ ...store, active: name });
  const id = store.ids[name];
  if (id) void pushLink(id, "active");
}

/** id специалиста по имени: из прикреплённых, иначе из уже сделанных записей. */
export function therapistId(name: string, bookings: { psyName: string; psychologistId?: number }[] = []): number | undefined {
  return loadTherapists().ids[name] ?? bookings.find((b) => b.psyName === name && b.psychologistId)?.psychologistId;
}

/**
 * Карточка закреплённого специалиста: кэш из базы, а в демо — бутафорский
 * каталог. Единственный источник для аватарки, чипов и ссылки на анкету во
 * всех разделах: раньше каждый экран искал специалиста в `PSYS` сам и в бою
 * не находил ничего.
 */
export function therapistCard(name: string, store?: TherapistStore): Psy | undefined {
  const base = store ?? loadTherapists();
  const id = base.ids[name];
  return (id ? base.cards[id] : undefined) ?? PSYS.find((item) => item.name === name);
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
    ids: store.ids,
    cards: store.cards,
    list,
    removed: [...new Set([...store.removed, name])],
    active: store.active === name ? list[0] ?? null : store.active,
  };
  saveTherapists(next);
  const id = store.ids[name];
  if (id) void pushLink(id, "detach");
  return next;
}
