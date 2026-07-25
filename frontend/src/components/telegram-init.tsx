"use client";

import { useEffect } from "react";

// Подготовка Mini App: полноэкранный режим (Bot API 8.0+), запрет сворачивания
// свайпом и отступы под системные зоны, которые в фуллскрине env() не отдаёт.
type Inset = { top?: number; bottom?: number; left?: number; right?: number };

type WebApp = {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  requestFullscreen?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
  safeAreaInset?: Inset;
  contentSafeAreaInset?: Inset;
  isFullscreen?: boolean;
  viewportStableHeight?: number;
  platform?: string;
};

function webApp(): WebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;
}

export function isTelegram(): boolean {
  if (typeof window === "undefined") return false;
  const app = webApp();
  return Boolean(app && app.platform && app.platform !== "unknown");
}

// setHeaderColor принимает только hex. Наши тона — это var() и color-mix(),
// поэтому пропускаем значение через пробный элемент: браузер сам сведёт его
// к rgb(), а мы переведём в hex.
function toHex(cssColor: string): string | null {
  const probe = document.createElement("span");
  probe.style.cssText = `position:fixed;left:-9999px;top:-9999px;background:${cssColor}`;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const parts = rgb.match(/\d+/g);
  if (!parts || parts.length < 3) return null;
  return "#" + parts.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("");
}

/**
 * Красит полоску Telegram под текущий экран. Без аргумента — под тон раздела.
 * Методы клиента бросают исключения (неподдерживаемая версия, фуллскрин без
 * шапки, невалидный цвет), а вызываем мы их в том числе из cleanup при уходе
 * с экрана — незакрытая ошибка там роняла всё приложение.
 */
export function syncTelegramChrome(cssColor?: string) {
  if (typeof window === "undefined") return;
  const app = webApp();
  if (!app) return;
  try {
    const source = cssColor ?? getComputedStyle(document.documentElement).getPropertyValue("--page").trim();
    const hex = toHex(source || "var(--bg)");
    if (!hex) return;
    app.setHeaderColor?.(hex);
    app.setBackgroundColor?.(hex);
  } catch {
    /* цвет — украшение, из-за него экран падать не должен */
  }
}

export function TelegramInit() {
  useEffect(() => {
    let tries = 0;
    let cleanup: (() => void) | undefined;

    const applyInsets = (app: WebApp) => {
      // В фуллскрине контент уходит под статус-бар и под плавающие кнопки
      // Telegram, поэтому берём отступы у самого клиента, а не у env().
      const safe = app.safeAreaInset ?? {};
      const content = app.contentSafeAreaInset ?? {};
      const root = document.documentElement;
      // --safe-top — системная зона (статус-бар), --tg-top — полоса под
      // плавающими кнопками клиента. Складывает их уже CSS в --top-pad,
      // с нижней границей на случай, если клиент отдал нули.
      if ((safe.top ?? 0) > 0) root.style.setProperty("--safe-top", `${safe.top}px`);
      if ((content.top ?? 0) > 0) root.style.setProperty("--tg-top", `${content.top}px`);
      const bottom = (safe.bottom ?? 0) + (content.bottom ?? 0);
      if (bottom > 0) root.style.setProperty("--safe-bottom", `${bottom}px`);
    };

    const setup = () => {
      const app = webApp();
      if (!app) {
        // Скрипт грузится после гидрации — ждём его недолго.
        if (tries++ < 20) window.setTimeout(setup, 150);
        return;
      }
      document.documentElement.dataset.tma = "1";
      // Каждый метод может бросить на неподдерживающем клиенте — по отдельности,
      // чтобы одна неудача не отменила остальную настройку.
      const attempt = (fn?: () => void) => { try { fn?.(); } catch { /* клиент не умеет — не беда */ } };
      attempt(() => app.ready?.());
      attempt(() => app.expand?.());
      // Полный экран без нативной шапки: остаётся только компактная кнопка
      // закрытия. Доступно с Bot API 8.0, на старых клиентах просто expand.
      if (app.isVersionAtLeast?.("8.0")) attempt(() => app.requestFullscreen?.());
      attempt(() => app.disableVerticalSwipes?.());

      syncTelegramChrome();

      const onChange = () => applyInsets(app);
      applyInsets(app);
      for (const event of ["safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged", "viewportChanged"]) {
        app.onEvent?.(event, onChange);
      }
      cleanup = () => {
        for (const event of ["safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged", "viewportChanged"]) {
          app.offEvent?.(event, onChange);
        }
      };
    };

    setup();
    return () => cleanup?.();
  }, []);
  return null;
}
