"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { Disclosure } from "@/components/ui";
import { WheelBars, WheelChart } from "@/components/wheel-chart";
import { wheelBand, wheelLowest, wheelPercent, type WheelResult } from "@/lib/therapy";
import { tap } from "@/lib/haptics";

const dateF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const TONE: Record<string, { bg: string; edge: string }> = {
  salmon: { bg: "var(--salmon-soft)", edge: "var(--salmon-edge)" },
  amber: { bg: "var(--amber-soft)", edge: "var(--amber-edge)" },
  green: { bg: "var(--green-soft)", edge: "var(--green-edge)" },
};

// Колесо баланса. Иконка-колесо + бейдж «!», если не пройдено. Мини-радар + разворачиваемый разбор.
export function WellbeingCard({ wheel, onStart, subtitle }: { wheel: WheelResult | null; onStart?: () => void; subtitle: string }) {
  const [open, setOpen] = useState(false);
  const pct = wheelPercent(wheel);
  const band = wheelBand(pct);
  const tone = TONE[band.tone];
  const lowest = wheelLowest(wheel, 2);

  return (
    <section className="rounded-[22px] p-4" style={{ background: "var(--purple-soft)", border: "var(--bw-lg) solid var(--purple-edge)" }}>
      <div className="flex items-center gap-3">
        <button onClick={onStart ? () => { tap(); onStart(); } : undefined} className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-[var(--purple)]" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }} aria-label="Колесо баланса">
          <Icon name="balance" width={28} weight="bold" />
          {!wheel && <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--coral)] text-[16px] font-black" style={{ border: "var(--bw) solid var(--coral-edge)" }}>!</span>}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Колесо баланса</p>
          {wheel ? (
            <div className="flex items-end gap-2">
              <span className="font-tight tnum text-[30px] font-black leading-none">{pct}%</span>
              <span className="mb-0.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase" style={{ background: tone.bg, border: `var(--bw) solid ${tone.edge}` }}>{band.label}</span>
            </div>
          ) : (
            <p className="text-[13px] font-bold text-[var(--muted)]">{onStart ? "Колесо ещё не собрано" : "Клиент ещё не проходил колесо"}</p>
          )}
        </div>
      </div>

      {wheel ? (
        <>
          <div className="mt-3 rounded-[17px] bg-[#fffdf7] p-2" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
            <WheelChart result={wheel} size={248} />
          </div>
          <p className="mt-2.5 text-[11px] font-semibold leading-snug text-[var(--muted)]">{band.hint}</p>
          {lowest.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-black uppercase text-[var(--muted-2)]">Проседает:</span>
              {lowest.map((d) => <span key={d.key} className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: d.color, border: `var(--bw) solid ${d.edge}` }}>{d.short}</span>)}
            </div>
          )}
          <button onClick={() => { tap(); setOpen(!open); }} className="mt-3 flex w-full items-center justify-between rounded-[13px] bg-white px-3.5 py-2.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
            <span className="text-[12px] font-black">Разбор по сферам</span>
            <span className="text-[13px] font-black transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
          </button>
          <Disclosure open={open}>
            <div className="mt-2 rounded-[15px] bg-[#fffdf7] p-3.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
              <WheelBars result={wheel} />
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-[var(--muted)]">Собрано {dateF.format(new Date(wheel.completedAt))} · {subtitle}</p>
                {onStart && <button onClick={() => { tap(); onStart(); }} className="shrink-0 rounded-full bg-[var(--purple-soft)] px-3 py-1 text-[10px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>Пройти заново</button>}
              </div>
            </div>
          </Disclosure>
        </>
      ) : onStart ? (
        <button onClick={() => { tap(); onStart(); }} className="mt-3 w-full rounded-[15px] bg-white p-3.5 text-left" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
          <p className="text-[14px] font-black">Собрать колесо баланса</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">10 сфер · 30 вопросов · {subtitle}</p>
        </button>
      ) : (
        <p className="mt-3 rounded-[15px] bg-white p-3 text-[11px] font-semibold text-[var(--muted)]" style={{ border: "var(--bw) solid var(--purple-edge)" }}>Появится здесь, когда клиент соберёт колесо между сессиями.</p>
      )}
    </section>
  );
}
