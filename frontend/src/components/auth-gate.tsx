"use client";

import { useState } from "react";
import { WebLogin } from "@/components/web-login";
import { Icon } from "@/components/icons";

/**
 * Экран для случая, когда войти не удалось. Раньше на этом месте крутился
 * бесконечный спиннер: токена не было, запросы уходили без Authorization,
 * сервер отвечал 401, а разделы так и оставались «в загрузке».
 */
export function AuthGate({ env, reason = "rejected", detail = "" }: { env: "tma" | "desktop"; reason?: "offline" | "rejected"; detail?: string }) {
  const desktop = env === "desktop";
  const offline = !desktop && reason === "offline";
  // Из браузера телефона вход теперь есть: тот же QR и почта, что на сайте.
  // Раньше здесь стоял тупик «откройте в Telegram».
  const [login, setLogin] = useState(false);
  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto" style={{ background: "var(--page)" }}>
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-[var(--top-pad)]">
        <span className="ico ico-accent h-14 w-14"><Icon name="lock" width={26} weight="bold" color="#fff" /></span>
        <h1 className="font-tight mt-3 text-[24px] font-black leading-tight">
          {desktop ? "Откройте в Telegram" : offline ? "Сервер не отвечает" : "Не удалось войти"}
        </h1>
        <p className="t-sub mt-1.5">
          {desktop
            ? "Войдите через Telegram — подтвердите вход в чате с ботом. Или по почте, если вы её привязали."
            : offline
              ? "Приложение не смогло связаться с сервером — скорее всего, он ещё не запущен. Данные Telegram при этом в порядке."
              : "Telegram передал данные, но сервер их не принял: возможно, сессия устарела. Обычно помогает перезапуск приложения."}
        </p>
        {desktop ? (
          <button onClick={() => setLogin(true)} className="btn btn-accent mt-5 w-full py-3">
            Войти
          </button>
        ) : (
          <button onClick={() => window.location.reload()} className="btn btn-accent mt-5 w-full py-3">
            Попробовать снова
          </button>
        )}
        {login && <WebLogin onClose={() => setLogin(false)} />}
        {/* Ответ сервера дословно: чтобы «не работает» можно было починить,
            а не пересказывать. Мелко и внизу — обычному человеку не мешает. */}
        {detail && <p className="t-cap mt-4 break-all opacity-60">{detail}</p>}
      </div>
    </div>
  );
}
