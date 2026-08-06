"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { DesktopLandingBody, DesktopLandingIntro } from "@/components/landing";
import { isTelegram } from "@/components/telegram-init";

import { APP_NAME } from "@/lib/brand";

// Рамка-телефон для десктопа: показывает, как приложение выглядит в Telegram.
// На мобильном — на весь экран. На главной вокруг рамки разворачивается лендинг:
// приложение при этом монтируется один раз, лендинг просто скрыт на мобильном
// через CSS — иначе получили бы две копии всего дерева.
export function DemoFrame({ children }: { children: ReactNode }) {
  const [inTelegram, setInTelegram] = useState(false);
  // В статике лендинг должен попасть в HTML (иначе его не увидит поисковик),
  // поэтому первый рендер всегда с ним, а на узком экране он снимается сразу
  // после гидратации — чтобы телефон не тащил лишние два десятка карточек.
  const [wide, setWide] = useState(true);
  const pathname = usePathname();
  useEffect(() => { const id = window.setTimeout(() => setInTelegram(isTelegram()), 400); return () => window.clearTimeout(id); }, []);
  useEffect(() => { setWide(window.matchMedia("(min-width: 768px)").matches); }, []);
  const landing = (pathname === "/" || pathname === "") && wide;
  if (inTelegram) return <>{children}</>;
  return (
    <div
      className={landing ? "" : "md:flex md:min-h-[100dvh] md:items-center md:justify-center md:p-8"}
      style={{ background: "radial-gradient(120% 80% at 50% -10%, #ffffff 0%, var(--bg) 55%)" }}
    >
      <div className="fixed left-4 top-4 z-50 hidden items-center gap-3 md:flex">
        <span
          className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]"
          style={{ border: "1px solid var(--hairline)" }}
        >
          <span className="sheen-fill h-1.5 w-1.5 rounded-full" />
          Демо · тестовые данные
        </span>
        <button
          onClick={() => {
            // Чистим по префиксу, а не по списку: ключ базы версионный
            // (psy_demo_db_v10), и перечисление тут разъезжалось при каждом бампе.
            for (const key of Object.keys(localStorage)) {
              if (key.startsWith("psy_demo") || key.startsWith("bereg")) localStorage.removeItem(key);
            }
            location.reload();
          }}
          className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)] transition-colors hover:text-[var(--ink)]"
          style={{ border: "1px solid var(--hairline)" }}
        >
          Сброс
        </button>
      </div>

      <div className={landing ? "md:mx-auto md:grid md:max-w-[1180px] md:grid-cols-[minmax(0,1fr)_425px] md:items-start md:gap-14 md:px-8 md:pb-8 md:pt-20" : "contents"}>
      {landing && <DesktopLandingIntro />}
      <div className={`${landing ? "md:sticky md:top-8 md:justify-self-end " : ""}md:rounded-[3rem] md:border md:border-[color:var(--hairline)] md:bg-white md:p-2.5 md:shadow-[0_50px_120px_-30px_rgba(44,46,49,0.4)]`}>
        <div
          data-testid="phone-screen"
          className={`relative md:w-[400px] md:overflow-hidden md:rounded-[2.4rem] md:[transform:translateZ(0)] ${landing ? "md:h-[min(720px,78vh)]" : "md:h-[min(864px,90vh)]"}`}
          style={{ background: "var(--bg)" }}
        >
          <div className="md:h-full md:overflow-y-auto">
            {/* Хром Telegram (только desktop) */}
            <div
              className="sticky top-0 z-40 hidden items-center justify-between px-5 py-2.5 backdrop-blur-xl md:flex"
              style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)", borderBottom: "1px solid var(--hairline)" }}
            >
              <span className="x-close text-[13px]">✕</span>
              <span className="text-[12px] font-semibold text-[var(--muted)]">{APP_NAME}</span>
              <span className="text-[15px] leading-none text-[var(--muted-2)]">⋮</span>
            </div>
            {children}
          </div>
        </div>
      </div>
      </div>
      {landing && <DesktopLandingBody />}
    </div>
  );
}
