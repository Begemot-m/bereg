// Определение среды выполнения: Telegram Mini App vs обычный десктопный браузер.
// Один и тот же код работает в обоих режимах — различаем их здесь.

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: "light" | "dark";
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
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
