"use client";

import { useEffect } from "react";

import { asset } from "@/lib/asset";

const BUILD = process.env.NEXT_PUBLIC_BUILD || "";
const KEY = "bereg_reloaded_for";

/**
 * Вебвью Telegram и CDN Pages держат старую разметку до десяти минут, поэтому
 * «я запушил, а не изменилось» — обычное дело. Спрашиваем у сервера, какая
 * сборка выложена, и один раз перезагружаемся, если на руках старая.
 * Метка приходит из CI: она же зашита в бандл, она же лежит в version.json.
 */
export function VersionCheck() {
  useEffect(() => {
    if (!BUILD) return;
    let stopped = false;

    const check = async () => {
      try {
        // Уникальный URL — иначе CDN отдаст тот же кеш, что и страницу.
        const res = await fetch(asset(`/version.json?t=${Date.now()}`), { cache: "no-store" });
        if (!res.ok || stopped) return;
        const { build } = (await res.json()) as { build?: string };
        if (stopped || !build || build === BUILD) return;
        // Перезагружаемся под конкретную сборку только один раз: если после
        // перезагрузки вебвью снова отдал старое, крутить цикл бессмысленно.
        if (sessionStorage.getItem(KEY) === build) return;
        sessionStorage.setItem(KEY, build);
        location.reload();
      } catch {
        /* оффлайн — работаем на том, что есть */
      }
    };

    check();
    const onShow = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { stopped = true; document.removeEventListener("visibilitychange", onShow); };
  }, []);

  return null;
}
