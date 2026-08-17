"use client";

import { useEffect, useState, type ReactNode } from "react";

import { DEMO } from "@/lib/demo";
import { isTelegramMiniApp } from "@/lib/telegram";

// Ширина колонки — крупный телефон. Меньше 448 px (@md у Tailwind), поэтому
// оболочка сама уходит в мобильную раскладку: сайдбар прячется, возвращаются
// нижние табы. Отдельного «десктопного» кода для этого не нужно.
const COLUMN = 430;
// Ниже этой ширины окно и так телефонное — рамку не показываем.
const WIDE_FROM = 520;

/**
 * Telegram на компьютере и на планшете: приложение всегда открывается
 * телефонной колонкой по центру. Интерфейс рисовался под телефон, а на широком
 * окне разъезжался в непроверенную раскладку с сайдбаром.
 *
 * Колонке задан `translateZ(0)`: для всего, что внутри лежит `position: fixed`
 * (модалки, знакомство, экран приглашения, нижние табы), точкой отсчёта
 * становится она, а не окно — иначе половина интерфейса уезжала к краям экрана.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    if (DEMO) return;
    let stopped = false;
    const measure = () => setFramed(isTelegramMiniApp() && window.innerWidth >= WIDE_FROM);
    // telegram-web-app.js подключается после гидрации: до него мини-приложение
    // выглядит обычным браузером. Ждём его так же, как вход — короткими
    // попытками, а не одной проверкой.
    const poll = (tries: number) => {
      if (stopped) return;
      if (isTelegramMiniApp() || tries >= 24) { measure(); return; }
      window.setTimeout(() => poll(tries + 1), 40);
    };
    poll(0);
    window.addEventListener("resize", measure);
    return () => { stopped = true; window.removeEventListener("resize", measure); };
  }, []);

  if (!framed) return <>{children}</>;

  return (
    <div className="fixed inset-0 flex justify-center overflow-hidden" style={{ background: "var(--ink)" }}>
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          maxWidth: COLUMN,
          transform: "translateZ(0)",
          background: "var(--page)",
          boxShadow: "0 0 60px rgba(0,0,0,.45)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
