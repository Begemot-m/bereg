"use client";

import { useEffect } from "react";

// Подготовка Mini App: разворачиваем на весь экран, красим шапку под приложение,
// гасим закрытие свайпом вниз (иначе скролл списков закрывает окно).
type WebApp = {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  requestFullscreen?: () => void;
  viewportStableHeight?: number;
  platform?: string;
};

export function isTelegram(): boolean {
  if (typeof window === "undefined") return false;
  const app = (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;
  return Boolean(app && app.platform && app.platform !== "unknown");
}

export function TelegramInit() {
  useEffect(() => {
    let tries = 0;
    const setup = () => {
      const app = (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;
      if (!app) {
        // Скрипт грузится после гидрации — ждём его недолго.
        if (tries++ < 20) window.setTimeout(setup, 150);
        return;
      }
      document.documentElement.dataset.tma = "1";
      app.ready?.();
      app.expand?.();
      app.disableVerticalSwipes?.();
      const head = getComputedStyle(document.documentElement).getPropertyValue("--page").trim() || "#f9f8f3";
      app.setHeaderColor?.(head);
      app.setBackgroundColor?.(head);
    };
    setup();
  }, []);
  return null;
}
