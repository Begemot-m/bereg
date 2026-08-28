"use client";

/**
 * Вход по ссылке на запись (`book_<id>`). Человек приходит к конкретному
 * специалисту и первым делом должен увидеть его карточку с окнами, а не
 * знакомство с платформой: знакомство предложим, когда он пойдёт дальше.
 *
 * Метка живёт в sessionStorage, а не в состоянии: разбор ссылки идёт один раз
 * за сеанс, а решать по ней приходится и в оболочке, и в экране согласия.
 */

const KEY = "bereg_booking_entry";

export function markBookingEntry(psyId: number) {
  try { sessionStorage.setItem(KEY, String(psyId)); } catch { /* приватный режим */ }
}

export function bookingEntryPsy(): number | null {
  if (typeof window === "undefined") return null;
  try { return Number(sessionStorage.getItem(KEY)) || null; } catch { return null; }
}

export function clearBookingEntry() {
  try { sessionStorage.removeItem(KEY); } catch { /* приватный режим */ }
}
