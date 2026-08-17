// Определение среды выполнения: Telegram Mini App vs обычный десктопный браузер.
// Один и тот же код работает в обоих режимах — различаем их здесь.

export type HomeScreenStatus = "unsupported" | "unknown" | "added" | "missed";

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: "light" | "dark";
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  version?: string;
  openTelegramLink?: (url: string) => void;
  addToHomeScreen?: () => void;
  checkHomeScreenStatus?: (cb: (status: HomeScreenStatus) => void) => void;
  onEvent?: (event: string, cb: (payload?: unknown) => void) => void;
  offEvent?: (event: string, cb: (payload?: unknown) => void) => void;
  platform?: string;
};

// Клиенты Telegram, работающие на компьютере. Список закрытый, а не «всё, что
// не android/ios»: незнакомую платформу пускаем внутрь — лучше показать
// приложение лишнему десктопу, чем закрыть его перед новым мобильным клиентом.
const DESKTOP_PLATFORMS = new Set(["tdesktop", "macos", "linux", "web", "weba", "webk", "unigram"]);

// Только эти клиенты реально кладут ярлык на рабочий стол сами.
const ANDROID_PLATFORMS = new Set(["android", "android_x"]);

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramMiniApp(): boolean {
  const wa = getTelegramWebApp();
  return Boolean(wa && wa.initData);
}

export function telegramPlatform(): string | null {
  const p = getTelegramWebApp()?.platform;
  return p && p !== "unknown" ? p : null;
}

/** Мини-приложение открыто в Telegram на компьютере. */
export function isDesktopTelegram(): boolean {
  const p = telegramPlatform();
  return Boolean(p && DESKTOP_PLATFORMS.has(p));
}

export function getInitData(): string | null {
  return getTelegramWebApp()?.initData ?? null;
}

// Ссылки на t.me внутри вебвью Telegram: `target="_blank"` там иногда молча
// ничего не делает, поэтому сначала пробуем родной метод клиента.
export function openTelegramLink(url: string): void {
  const wa = getTelegramWebApp();
  if (wa?.openTelegramLink) {
    wa.openTelegramLink(url);
    return;
  }
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}

// Иконка мини-приложения на рабочем столе — Bot API 8.0. У старых клиентов
// метода нет вовсе, у новых он может ответить не сразу, поэтому ждём ответ
// ограниченное время и по молчанию считаем, что возможности нет.
export function homeScreenStatus(timeout = 1500): Promise<HomeScreenStatus> {
  const wa = getTelegramWebApp();
  const check = wa?.checkHomeScreenStatus;
  if (!wa || !check) return Promise.resolve("unsupported");
  return new Promise((resolve) => {
    let done = false;
    const finish = (status: HomeScreenStatus) => {
      if (done) return;
      done = true;
      resolve(status);
    };
    const timer = setTimeout(() => finish("unsupported"), timeout);
    try {
      check.call(wa, (status) => {
        clearTimeout(timer);
        finish(status);
      });
    } catch {
      clearTimeout(timer);
      finish("unsupported");
    }
  });
}

export function addToHomeScreen(): void {
  getTelegramWebApp()?.addToHomeScreen?.();
}

export type HomeScreenMode = "native" | "manual" | "none";

/** iPhone или iPad — и внутри Telegram, и в обычном браузере. */
export function isApplePhone(): boolean {
  const p = telegramPlatform();
  if (p) return p === "ios";
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

/**
 * Что клиент реально умеет с иконкой на рабочем столе.
 *
 * `addToHomeScreen` из Bot API 8.0 честно работает только на Android: там
 * Telegram кладёт ярлык через системный диалог. На iPhone метод в API есть, но
 * не делает ничего — iOS не даёт приложениям ставить иконки. Поэтому
 * `checkHomeScreenStatus` отвечает там `unknown` («поддерживается, но не знаю
 * статус»), блок показывался, а кнопка молчала. Единственный путь на iPhone —
 * веб-ярлык из браузера, и его надо объяснить словами, а не изображать кнопкой.
 */
export function homeScreenMode(): HomeScreenMode {
  const wa = getTelegramWebApp();
  const platform = telegramPlatform();
  if (!wa || !platform) return isMobileBrowser() ? "manual" : "none";
  if (DESKTOP_PLATFORMS.has(platform)) return "none";
  if (ANDROID_PLATFORMS.has(platform) && typeof wa.addToHomeScreen === "function") return "native";
  return "manual";
}

/** Подписка на подтверждение от клиента Telegram, что иконка добавлена. */
export function onHomeScreenAdded(cb: () => void): () => void {
  const wa = getTelegramWebApp();
  if (!wa?.onEvent) return () => {};
  wa.onEvent("homeScreenAdded", cb);
  return () => wa.offEvent?.("homeScreenAdded", cb);
}
