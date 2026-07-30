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

    let cancelled = false;

    // telegram-web-app.js подключён с afterInteractive, то есть появляется
    // уже после гидрации. Если спросить среду сразу, мини-приложение выглядит
    // как обычный браузер — и вход не случается вовсе. Ждём так же, как это
    // делает TelegramInit: короткими попытками, а не одной проверкой.
    const waitForTelegram = async () => {
      for (let i = 0; i < 20; i++) {
        if (isTelegramMiniApp()) return true;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return isTelegramMiniApp();
    };

    void (async () => {
      const inTelegram = await waitForTelegram();
      if (cancelled) return;
      setEnv(inTelegram ? "tma" : "desktop");

      // Цвет системной полоски ставит TelegramInit по тону раздела —
      // здесь его трогать не нужно, иначе экраны получат чужой фон.
      const wa = getTelegramWebApp();
      wa?.ready();
      wa?.expand();

      if (inTelegram) {
        const initData = getInitData();
        if (initData) {
          try {
            await loginWithInitData(initData);
            if (!cancelled) setState("authed");
          } catch {
            // Подпись не сошлась или initData просрочен: сервер отвечает 401.
            // Показываем это словами, а не бесконечной загрузкой.
            if (!cancelled) setState("anon");
          }
          return;
        }
      }

      // На десктопе: если уже есть токен — считаем авторизованным (Фаза 0).
      // Полноценный десктоп-вход (Telegram Login Widget / email-код) — следующий шаг.
      if (!cancelled) setState(getAccess() ? "authed" : "anon");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { env, state };
}
