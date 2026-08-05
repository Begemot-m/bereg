"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Telegram отдаёт метку из ссылки t.me/<bot>?startapp=<payload> в start_param.
// По ней приложение открывается сразу на нужном экране, а не на главной.
type InitData = { start_param?: string };

export function startParam(): string | null {
  if (typeof window === "undefined") return null;
  const app = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: InitData } } }).Telegram?.WebApp;
  const fromTelegram = app?.initDataUnsafe?.start_param;
  if (fromTelegram) return fromTelegram;
  // Веб-версия и отладка: тот же payload можно передать в адресе. Telegram
  // Desktop и веб-клиент кладут его в tgWebAppStartParam — в query или в хеш.
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return search.get("startapp") ?? search.get("tgWebAppStartParam") ?? hash.get("tgWebAppStartParam");
}

/** Адрес экрана по метке из ссылки, если она нам знакома. */
export function target(payload: string): string | null {
  // book_<id> — приглашение специалиста на запись.
  const book = /^book_(\d+)$/.exec(payload);
  if (book) return `/catalog?psy=${book[1]}&book=1`;
  return null;
}

/** Пришли ли по ссылке-приглашению на запись — её пускаем и без входа. */
export function hasBookingDeepLink(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("psy") || params.get("book")) return true;
  const payload = startParam();
  return Boolean(payload && target(payload));
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
