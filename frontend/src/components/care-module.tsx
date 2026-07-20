"use client";

import { Icon } from "@/components/icons";
import { APP_NAME, CENTER, CENTER_SITE, CENTER_URL, TAGLINE } from "@/lib/brand";
import { tap } from "@/lib/haptics";

const TG_PHONE = "+79117230099";
const TG_LINK = `https://t.me/${TG_PHONE}`;

// Единый блок: центр-создатель (с переходом на сайт) + связь в Telegram.
export function CareModule() {
  return (
    <div className="chunk overflow-hidden">
      {/* Центр-создатель */}
      <div className="flex items-center gap-3 p-4" style={{ background: "var(--ink)" }}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-[18px] font-black text-[var(--ink)]" style={{ background: "var(--amber)" }}>{APP_NAME.charAt(0)}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(255,255,255,.6)]">Платформу создал центр</p>
          <p className="font-tight text-[18px] font-black text-white">{CENTER}</p>
        </div>
      </div>

      <div className="p-4">
        <p className="text-[13px] leading-relaxed text-[var(--muted)]">{TAGLINE}. {APP_NAME} — инструмент центра для качественной помощи и самопомощи.</p>
        <a href={CENTER_URL} target="_blank" rel="noopener noreferrer" onClick={() => tap()} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-black text-[var(--edge)] hover:underline">
          {CENTER_SITE} <span className="text-[15px]">→</span>
        </a>

        {/* Связь в Telegram */}
        <a href={TG_LINK} target="_blank" rel="noopener noreferrer" onClick={() => tap()} className="mt-4 flex items-center gap-3 rounded-[16px] p-3 transition-transform active:scale-[0.99]" style={{ background: "var(--head-soft)", border: "var(--bw) solid var(--edge)" }}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white" style={{ border: "var(--bw) solid var(--edge)" }}><Icon name="spark" width={20} weight="fill" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black leading-tight">Мы всегда на связи в Telegram</span>
            <span className="block text-[11px] font-semibold text-[var(--muted)]">Есть вопросы и пожелания — пишите напрямую нам</span>
          </span>
          <span className="text-[16px] font-black text-[var(--edge)]">›</span>
        </a>
      </div>
    </div>
  );
}
