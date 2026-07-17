"use client";

import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/brand";

// Рамка-телефон для десктопа: показывает, как приложение выглядит в Telegram.
// На мобильном — на весь экран.
export function DemoFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="md:flex md:min-h-[100dvh] md:items-center md:justify-center md:p-8"
      style={{ background: "radial-gradient(120% 80% at 50% -10%, #ffffff 0%, var(--bg) 55%)" }}
    >
      <div className="fixed left-4 top-4 z-50 hidden items-center gap-3 md:flex">
        <span
          className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
          style={{ border: "1px solid var(--hairline)" }}
        >
          <span className="sheen-fill h-1.5 w-1.5 rounded-full" />
          Демо · тестовые данные
        </span>
        <button
          onClick={() => {
            localStorage.removeItem("psy_demo_db_v5");
            localStorage.removeItem("psy_demo_role");
            localStorage.removeItem("bereg_onboarded");
            localStorage.removeItem("bereg_psy_profile");
            location.reload();
          }}
          className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)] transition-colors hover:text-[var(--ink)]"
          style={{ border: "1px solid var(--hairline)" }}
        >
          Сброс
        </button>
      </div>

      <div className="md:rounded-[3rem] md:border md:border-[color:var(--hairline)] md:bg-white md:p-2.5 md:shadow-[0_50px_120px_-30px_rgba(44,46,49,0.4)]">
        <div
          className="relative md:h-[min(864px,90vh)] md:w-[400px] md:overflow-hidden md:rounded-[2.4rem] md:[transform:translateZ(0)]"
          style={{ background: "var(--bg)" }}
        >
          <div className="md:h-full md:overflow-y-auto">
            {/* Хром Telegram (только desktop) */}
            <div
              className="sticky top-0 z-40 hidden items-center justify-between px-5 py-2.5 backdrop-blur-xl md:flex"
              style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)", borderBottom: "1px solid var(--hairline)" }}
            >
              <span className="text-[13px] text-[var(--muted-2)]">✕</span>
              <span className="text-[12px] font-semibold text-[var(--muted)]">{APP_NAME}</span>
              <span className="text-[15px] leading-none text-[var(--muted-2)]">⋮</span>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
