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

// Щелчок диска: короткий клик через WebAudio + микровибрация.
let ctx: AudioContext | null = null;
let muted = false;

export function setTickMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") localStorage.setItem("bereg:tick-muted", value ? "1" : "0");
}

export function tickMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("bereg:tick-muted") === "1";
}

/** Щелчок при прокрутке диска — как у механического таймера. */
export function tick() {
  select();
  if (typeof window === "undefined" || muted || tickMuted()) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = ctx ?? new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1750, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.02);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch { /* звук не критичен */ }
}
