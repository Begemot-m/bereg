"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Telegram отдаёт метку из ссылки t.me/<bot>?startapp=<payload> в start_param.
// По ней приложение открывается сразу на нужном экране, а не на главной.
type InitData = { start_param?: string };

function startParam(): string | null {
  const app = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: InitData } } }).Telegram?.WebApp;
  const fromTelegram = app?.initDataUnsafe?.start_param;
  if (fromTelegram) return fromTelegram;
  // Веб-версия и отладка: тот же payload можно передать в адресе.
  return new URLSearchParams(window.location.search).get("startapp");
}

function target(payload: string): string | null {
  // book_<id> — приглашение специалиста на запись.
  const book = /^book_(\d+)$/.exec(payload);
  if (book) return `/catalog?psy=${book[1]}&book=1`;
  return null;
}

export function StartRoute() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const run = () => {
      const payload = startParam();
      // Скрипт Telegram подключается после гидрации — ждём его недолго.
      if (!payload) {
        if (tries++ < 20) window.setTimeout(run, 150);
        return;
      }
      const href = target(payload);
      if (href) router.replace(href);
    };
    run();
  }, [router]);
  return null;
}
