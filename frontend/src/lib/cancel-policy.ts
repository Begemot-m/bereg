"use client";

import { useEffect, useState } from "react";

// Запрет отмены сессии за N дней до неё (0 — отмена всегда разрешена).
const KEY = "bereg_cancel_lock_days";
const EVENT = "bereg-cancel-policy-change";

export function getCancelLockDays(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(KEY) || 0);
}
export function setCancelLockDays(days: number) {
  localStorage.setItem(KEY, String(Math.max(0, days)));
  window.dispatchEvent(new CustomEvent(EVENT));
}
export function useCancelLockDays(): [number, (d: number) => void] {
  const [d, setD] = useState(0);
  useEffect(() => {
    setD(getCancelLockDays());
    const on = () => setD(getCancelLockDays());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [d, (next: number) => { setCancelLockDays(next); setD(Math.max(0, next)); }];
}

// Можно ли ещё отменить: true, если до сессии >= lockDays.
export function canCancel(startsAt: string, lockDays: number): boolean {
  if (lockDays <= 0) return true;
  const days = (new Date(startsAt).getTime() - Date.now()) / 86_400_000;
  return days >= lockDays;
}
