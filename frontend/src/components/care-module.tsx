"use client";

import { motion } from "motion/react";
import type { CSSProperties } from "react";

import { Icon } from "@/components/icons";
import { Arrow, ArrowGlyph } from "@/components/blocks";
import { APP_NAME, CENTER, CENTER_SITE, CENTER_URL, TAGLINE } from "@/lib/brand";
import { tap } from "@/lib/haptics";

const TG_PHONE = "+79117230099";
const TG_LINK = `https://t.me/${TG_PHONE}`;

// Постер-блок отдела заботы: сплошная заливка в тонах приложения, живые детали,
// переход на сайт центра и связь в Telegram.
export function CareModule() {
  return (
    <div className="relative overflow-hidden rounded-[20px] p-5" style={{ background: "var(--purple)" }}>
      {/* Плавающий декор — как на постерах в рефах */}
      <span aria-hidden className="float-y absolute -right-8 -top-10 h-28 w-28 rounded-full" style={{ background: "rgba(255,255,255,.28)", "--float-shift": "10px" } as CSSProperties} />
      <span aria-hidden className="float-y absolute -bottom-6 right-12 h-14 w-14 rounded-full" style={{ background: "rgba(255,255,255,.2)", "--float-shift": "-8px", "--float-time": "4.4s" } as CSSProperties} />
      <span aria-hidden className="soft-pulse absolute bottom-8 left-6 h-2.5 w-2.5 rounded-full" style={{ background: "rgba(255,255,255,.55)" }} />

      <div className="relative">
        <div className="flex items-center gap-2.5">
          <motion.span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-[18px] font-black text-white" style={{ background: "var(--ink)" }} animate={{ rotate: [0, -6, 6, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>{APP_NAME.charAt(0)}</motion.span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--ink)] opacity-70">Отдел заботы</p>
            <p className="font-tight text-[19px] font-black leading-tight">{CENTER}</p>
          </div>
        </div>

        <p className="mt-3 text-[13px] font-bold leading-snug">{TAGLINE}. {APP_NAME} — инструмент центра для качественной помощи и самопомощи.</p>

        <a href={CENTER_URL} target="_blank" rel="noopener noreferrer" onClick={() => tap()} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-black text-[var(--ink)] underline-offset-2 hover:underline">
          {CENTER_SITE} <ArrowGlyph />
        </a>

        {/* Связь в Telegram — с настоящим значком Telegram */}
        <a href={TG_LINK} target="_blank" rel="noopener noreferrer" onClick={() => tap()} className="card-nested mt-4 flex items-center gap-3 p-3 transition-transform active:scale-[0.99]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--purple-soft)" }}><Icon name="telegram" width={22} weight="fill" color="var(--purple-edge)" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black leading-tight">Мы всегда на связи в Telegram</span>
            <span className="block text-[11px] font-semibold text-[var(--muted)]">Вопросы и пожелания — пишите напрямую нам</span>
          </span>
          <Arrow />
        </a>
      </div>
    </div>
  );
}
