"use client";

import { useEffect, useState } from "react";

const KEY = "bereg_account_email";
const EVENT = "bereg:account";

export function getEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Почта учётной записи. В демо живёт на устройстве: письма слать некому,
 * но привязка нужна, чтобы войти не только из Telegram.
 */
export function useAccountEmail(): [string | null, (value: string | null) => void] {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setEmail(getEmail());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const save = (value: string | null) => {
    if (value) localStorage.setItem(KEY, value.trim().toLowerCase());
    else localStorage.removeItem(KEY);
    setEmail(value ? value.trim().toLowerCase() : null);
    window.dispatchEvent(new Event(EVENT));
  };

  return [email, save];
}
