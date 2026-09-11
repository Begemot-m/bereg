"use client";

import { useEffect, useState } from "react";

/**
 * Открыто ли приложение в браузере, а не в мини-приложении. Флаг ставят
 * оболочки (`demo-frame.tsx`, `phone-shell.tsx`) на `<html>`, и ставят поздно —
 * после того, как дождутся telegram-web-app.js. Поэтому не разовая проверка, а
 * подписка: иначе первый рендер решал бы за всю сессию.
 */
export function useWebMode(): boolean {
  const [web, setWeb] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setWeb(el.dataset.web === "1");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-web"] });
    return () => mo.disconnect();
  }, []);
  return web;
}
