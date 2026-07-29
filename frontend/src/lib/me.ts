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

/**
 * Кто вошёл. Нужен интерфейсу ровно для одного: показывать ли то, что
 * доступно не всем. Скрытая кнопка защитой не является — сервер всё равно
 * проверяет права на каждом запросе.
 *
 * В демо админку показываем: демо и существует, чтобы показывать.
 */
export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: async () => {
      if (DEMO) return { id: 1, username: "demo", firstName: "Демо", role: "psychologist", isAdmin: true };
      return apiFetch<Me>("/auth/me");
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
