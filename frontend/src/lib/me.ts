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

// Демо открыто всем подряд, поэтому админку там прячем за признаком: один раз
// зайти с ?admin=1, дальше браузер помнит. Случайный посетитель прототипа
// админку не увидит, а владелец может её показать и пощупать без сервера.
const DEMO_ADMIN_KEY = "bereg_demo_admin";

function demoAdmin(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("admin");
  if (q === "1") localStorage.setItem(DEMO_ADMIN_KEY, "1");
  if (q === "0") localStorage.removeItem(DEMO_ADMIN_KEY);
  return localStorage.getItem(DEMO_ADMIN_KEY) === "1";
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
        const admin = demoAdmin();
        return {
          id: 1,
          username: admin ? "mmgorba" : "demo",
          firstName: "Демо",
          role: "psychologist",
          isAdmin: admin,
        };
      }
      return apiFetch<Me>("/auth/me");
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
