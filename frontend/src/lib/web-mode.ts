"use client";

import { useSyncExternalStore } from "react";

/**
 * Открыто ли приложение в браузере, а не в мини-приложении. Флаг ставят
 * оболочки (`demo-frame.tsx`, `phone-shell.tsx`) на `<html>`, и ставят поздно —
 * после того, как дождутся telegram-web-app.js. Поэтому не разовая проверка, а
 * подписка: иначе первый рендер решал бы за всю сессию.
 */
function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-web"] });
  return () => mo.disconnect();
}

export function useWebMode(): boolean {
  // Через useSyncExternalStore, а не эффектом: флаг ставит инлайн-скрипт в
  // layout ещё до гидрации, и подписка читает его в первом же клиентском
  // рендере. Эффект давал лишний кадр телефонной вёрстки. Серверный снимок —
  // всегда false: в статическом HTML лежит мобильная разметка.
  return useSyncExternalStore(subscribe, () => document.documentElement.dataset.web === "1", () => false);
}
