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
};

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

/** Подписка на подтверждение от клиента Telegram, что иконка добавлена. */
export function onHomeScreenAdded(cb: () => void): () => void {
  const wa = getTelegramWebApp();
  if (!wa?.onEvent) return () => {};
  wa.onEvent("homeScreenAdded", cb);
  return () => wa.offEvent?.("homeScreenAdded", cb);
}
