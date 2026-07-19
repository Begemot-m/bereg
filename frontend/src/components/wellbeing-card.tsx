"use client";

import { useState } from "react";

import { Who5Bars } from "@/components/balance-bars";
import { Icon } from "@/components/icons";
import { Disclosure } from "@/components/ui";
import { who5Band, who5Score, type Who5Result } from "@/lib/therapy";
import { tap } from "@/lib/haptics";

const dateF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const TONE: Record<string, { bg: string; edge: string }> = {
  salmon: { bg: "var(--salmon-soft)", edge: "var(--salmon-edge)" },
  amber: { bg: "var(--amber-soft)", edge: "var(--amber-edge)" },
  green: { bg: "var(--green-soft)", edge: "var(--green-edge)" },
};

// Благополучие по WHO-5. Иконка-колесо + бейдж «!», если шкала не пройдена.
// Разбор по пунктам — разворачиваемое меню. Обводки — в цвет своего блока.
export function WellbeingCard({ who5, onStart, subtitle }: { who5: Who5Result | null; onStart?: () => void; subtitle: string }) {
  const [open, setOpen] = useState(false);
  const pct = who5Score(who5);
  const band = who5Band(pct);
  const tone = TONE[band.tone];

  return (
    <section className="rounded-[22px] p-4" style={{ background: "var(--purple-soft)", border: "var(--bw-lg) solid var(--purple-edge)" }}>
      <div className="flex items-center gap-3">
        <button onClick={onStart ? () => { tap(); onStart(); } : undefined} className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-[var(--purple)]" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }} aria-label="Колесо благополучия">
          <Icon name="balance" width={28} weight="bold" />
          {!who5 && <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--coral)] text-[16px] font-black" style={{ border: "var(--bw) solid var(--coral-edge)" }}>!</span>}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Благополучие · WHO-5</p>
          {who5 ? (
            <div className="flex items-end gap-2">
              <span className="font-tight tnum text-[30px] font-black leading-none">{pct}%</span>
              <span className="mb-0.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase" style={{ background: tone.bg, border: `var(--bw) solid ${tone.edge}` }}>{band.label}</span>
            </div>
          ) : (
            <p className="text-[13px] font-bold text-[var(--muted)]">{onStart ? "Шкала ещё не пройдена" : "Клиент ещё не проходил шкалу"}</p>
          )}
        </div>
      </div>

      {who5 ? (
        <>
          <p className="mt-2.5 text-[11px] font-semibold leading-snug text-[var(--muted)]">{band.hint}</p>
          <button onClick={() => { tap(); setOpen(!open); }} className="mt-3 flex w-full items-center justify-between rounded-[13px] bg-white px-3.5 py-2.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
            <span className="text-[12px] font-black">Разбор по пунктам</span>
            <span className="text-[13px] font-black transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
          </button>
          <Disclosure open={open}>
            <div className="mt-2 rounded-[15px] bg-[#fffdf7] p-3.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
              <Who5Bars who5={who5} />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-[var(--muted)]">Пройдено {dateF.format(new Date(who5.completedAt))} · {subtitle}</p>
                {onStart && <button onClick={() => { tap(); onStart(); }} className="rounded-full bg-[var(--purple-soft)] px-3 py-1 text-[10px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>Пройти заново</button>}
              </div>
            </div>
          </Disclosure>
        </>
      ) : onStart ? (
        <button onClick={() => { tap(); onStart(); }} className="mt-3 w-full rounded-[15px] bg-white p-3.5 text-left" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
          <p className="text-[14px] font-black">Пройти шкалу WHO-5</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">5 пунктов · около минуты · {subtitle}</p>
        </button>
      ) : (
        <p className="mt-3 rounded-[15px] bg-white p-3 text-[11px] font-semibold text-[var(--muted)]" style={{ border: "var(--bw) solid var(--purple-edge)" }}>Появится здесь, когда клиент заполнит шкалу между сессиями.</p>
      )}
    </section>
  );
}
