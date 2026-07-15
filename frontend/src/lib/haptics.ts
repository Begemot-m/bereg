"use client";

// Микровибрации: в Telegram — нативный HapticFeedback, в браузере — navigator.vibrate.

type TgHaptic = {
  impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  selectionChanged?: () => void;
  notificationOccurred?: (type: "error" | "success" | "warning") => void;
};

function tg(): TgHaptic | null {
  if (typeof window === "undefined") return null;
  // @ts-expect-error — глобал Telegram задан снаружи
  return window.Telegram?.WebApp?.HapticFeedback ?? null;
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined") navigator.vibrate?.(pattern);
}

/** Лёгкий тап — нажатия кнопок, карточек. */
export function tap() {
  const h = tg();
  if (h?.impactOccurred) h.impactOccurred("light");
  else vibrate(8);
}

/** Смена выбора — табы, фильтры, тумблеры, дни календаря. */
export function select() {
  const h = tg();
  if (h?.selectionChanged) h.selectionChanged();
  else vibrate(4);
}

/** Успех — оплата, отправка, запись. */
export function success() {
  const h = tg();
  if (h?.notificationOccurred) h.notificationOccurred("success");
  else vibrate([10, 40, 14]);
}
