"use client";

import { useEffect, useState } from "react";

import { hasLiveSession, loginWithInitData, LoginError, type LoginFailure } from "@/lib/api";
import { DEMO } from "@/lib/demo";
import { getInitData, getTelegramWebApp, isTelegramMiniApp } from "@/lib/telegram";

export type Env = "tma" | "desktop";
export type AuthState = "loading" | "authed" | "anon";

export function useAuth() {
  const [env, setEnv] = useState<Env>("desktop");
  const [state, setState] = useState<AuthState>("loading");
  const [reason, setReason] = useState<LoginFailure>("rejected");
  // Ответ сервера дословно: без него «не удалось войти» невозможно чинить.
  const [detail, setDetail] = useState("");

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
    // Шаг короткий: скрипт появляется в первые сотни миллисекунд, а редкими
    // опросами по 150 мс мы держали белый экран до трёх секунд на ровном месте.
    const waitForTelegram = async () => {
      for (let i = 0; i < 24; i++) {
        if (isTelegramMiniApp()) return true;
        await new Promise((resolve) => setTimeout(resolve, 40));
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
          } catch (error) {
            // Вход по initData не прошёл — это ещё не приговор. Человек мог
            // заходить раньше: тогда на руках живая кука сессии, и выгонять его
            // экраном «Не удалось войти» не за что.
            const live = await hasLiveSession().catch(() => false);
            if (cancelled) return;
            if (live) { setState("authed"); return; }
            // Сервер не поднят или отказал — говорим словами, а не бесконечной
            // загрузкой, и не путаем недоступность с просроченной подписью.
            setReason(error instanceof LoginError ? error.kind : "offline");
            setDetail(error instanceof LoginError ? error.detail : String(error));
            setState("anon");
          }
          return;
        }
      }

      // На десктопе доверяем только живой серверной сессии, а не следам
      // старого токена в localStorage.
      const live = await hasLiveSession();
      if (!cancelled) setState(live ? "authed" : "anon");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { env, state, reason, detail };
}
