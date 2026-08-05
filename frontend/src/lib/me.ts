"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { DEMO } from "@/lib/demo";

export type Me = {
  id: number;
  username: string | null;
  firstName: string | null;
  role: string;
  isAdmin: boolean;
};

// Демо открыто всем подряд, поэтому админку там прячем за тем же признаком,
// что и в проде, — ником владельца. Ник вводится в кабинете и живёт в
// localStorage. Случайный посетитель прототипа админку не увидит, а владельцу
// не надо помнить служебный адрес со ?admin=1.
export const DEMO_OWNER = "mmgorba";

const DEMO_USER_KEY = "bereg_demo_username";
/** Прежний способ входа. Читаем один раз и переводим на ник. */
const DEMO_ADMIN_KEY = "bereg_demo_admin";

const clean = (name: string) => name.trim().replace(/^@/, "").toLowerCase();

/** Кем представляется демо. Пустое значение возвращает обычного гостя. */
export function setDemoUsername(name: string) {
  const value = clean(name);
  if (value && value !== "demo") localStorage.setItem(DEMO_USER_KEY, value);
  else localStorage.removeItem(DEMO_USER_KEY);
}

function demoUsername(): string {
  if (typeof window === "undefined") return "demo";

  if (localStorage.getItem(DEMO_ADMIN_KEY) === "1") {
    localStorage.setItem(DEMO_USER_KEY, DEMO_OWNER);
    localStorage.removeItem(DEMO_ADMIN_KEY);
  }

  // Старые ссылки со ?admin=1 продолжают работать.
  const q = new URLSearchParams(window.location.search).get("admin");
  if (q === "1") localStorage.setItem(DEMO_USER_KEY, DEMO_OWNER);
  if (q === "0") localStorage.removeItem(DEMO_USER_KEY);

  return localStorage.getItem(DEMO_USER_KEY) ?? "demo";
}

/**
 * Кто вошёл. Нужен интерфейсу ровно для одного: показывать ли то, что
 * доступно не всем. Скрытая кнопка защитой не является — сервер всё равно
 * проверяет права на каждом запросе.
 *
 * Админский блок скрыт для всех, кроме владельца @mmgorba.
 */
export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: async () => {
      if (DEMO) {
        const username = demoUsername();
        return {
          id: 1,
          username,
          firstName: "Демо",
          role: "psychologist",
          isAdmin: username === DEMO_OWNER,
        };
      }
      return apiFetch<Me>("/auth/me");
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
