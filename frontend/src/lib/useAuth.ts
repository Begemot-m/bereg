"use client";

import { useEffect, useState } from "react";

import { getAccess, loginWithInitData } from "@/lib/api";
import { DEMO } from "@/lib/demo";
import { getInitData, getTelegramWebApp, isTelegramMiniApp } from "@/lib/telegram";

export type Env = "tma" | "desktop";
export type AuthState = "loading" | "authed" | "anon";

export function useAuth() {
  const [env, setEnv] = useState<Env>("desktop");
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    // Демо: сразу авторизованы, показываем как в Telegram-приложении.
    if (DEMO) {
      setEnv("tma");
      setState("authed");
      return;
    }

    const wa = getTelegramWebApp();
    wa?.ready();
    wa?.expand();
    // Тёмная тема: красим системный хром Telegram под чёрный фон приложения.
    wa?.setHeaderColor?.("#050505");
    wa?.setBackgroundColor?.("#050505");
    setEnv(isTelegramMiniApp() ? "tma" : "desktop");

    (async () => {
      // В TMA авторизуемся автоматически через initData.
      if (isTelegramMiniApp()) {
        const initData = getInitData();
        if (initData) {
          try {
            await loginWithInitData(initData);
            setState("authed");
            return;
          } catch {
            setState("anon");
            return;
          }
        }
      }
      // На десктопе: если уже есть токен — считаем авторизованным (Фаза 0).
      // Полноценный десктоп-вход (Telegram Login Widget / email-код) — следующий шаг.
      setState(getAccess() ? "authed" : "anon");
    })();
  }, []);

  return { env, state };
}
