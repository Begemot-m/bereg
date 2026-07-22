"use client";

// Микровибрации: в Telegram — нативный HapticFeedback, в браузере — navigator.vibrate.

type TgHaptic = {
  impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  selectionChanged?: () => void;
  notificationOccurred?: (type: "error" | "success" | "warning") => void;
};

function tg(): TgHaptic | null {
  if (typeof window === "undefined") return null;
  const telegram = window as unknown as {
    Telegram?: { WebApp?: { HapticFeedback?: TgHaptic; isVersionAtLeast?: (version: string) => boolean } };
  };
  const webApp = telegram.Telegram?.WebApp;
  if (!webApp || (webApp.isVersionAtLeast && !webApp.isVersionAtLeast("6.1"))) return null;
  return webApp.HapticFeedback ?? null;
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

// Щелчок шкалы: короткий клик через WebAudio + микровибрация.
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

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = ctx ?? new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function primeTick() {
  const audio = audioContext();
  if (audio?.state === "suspended") void audio.resume();
}

function soundAt(audio: AudioContext, when: number) {
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1660, when);
    osc.frequency.exponentialRampToValueAtTime(820, when + 0.018);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.052, when + 0.0025);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.028);
    osc.connect(gain).connect(audio.destination);
    osc.start(when);
    osc.stop(when + 0.032);
  } catch { /* звук не критичен */ }
}

/** Щелчок при прокрутке шкалы — как у механического таймера. */
export function tick() {
  select();
  if (typeof window === "undefined" || muted || tickMuted()) return;
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  soundAt(audio, audio.currentTime);
}

/**
 * Проигрывает отдельный отклик для каждого пересечённого деления текущего кадра.
 * Весь короткий burst укладывается максимум в 80 мс и не доигрывает старую очередь.
 */
export function tickSteps(count: number) {
  if (typeof window === "undefined") return;
  const total = Math.max(0, Math.floor(count));
  if (!total) return;

  const haptic = tg();
  if (haptic?.selectionChanged) {
    for (let index = 0; index < total; index += 1) haptic.selectionChanged();
  } else {
    const pattern = Array.from({ length: total * 2 - 1 }, (_, index) => index % 2 === 0 ? 3 : 5);
    vibrate(pattern);
  }

  if (muted || tickMuted()) return;
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  const gap = Math.min(0.014, 0.08 / total);
  for (let index = 0; index < total; index += 1) {
    soundAt(audio, audio.currentTime + index * gap);
  }
}
