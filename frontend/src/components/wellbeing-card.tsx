"use client";

import { useState } from "react";
import { ArrowGlyph } from "@/components/blocks";

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
    <section className="rounded-[20px] bg-[var(--purple-soft)] p-4" data-tour="wheel">
      <div className="flex items-center gap-3">
        <button onClick={onStart ? () => { tap(); onStart(); } : undefined} className="ico ico-accent relative h-14 w-14 shrink-0" aria-label="Колесо баланса">
          <Icon name="balance" width={28} weight="bold" color="#fff" />
          {!wheel && <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--coral)] text-[16px] font-black">!</span>}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-tight text-[18px] font-black text-[var(--ink)]">Колесо баланса</p>
          {wheel ? (
            <div className="flex items-end gap-2">
              <span className="font-tight tnum text-[30px] font-black leading-none">{pct}%</span>
              <span className="chip mb-0.5 uppercase" style={{ background: tone.bg }}>{band.label}</span>
            </div>
          ) : (
            <p className="text-[13px] font-bold text-[var(--muted)]">{onStart ? "Колесо ещё не собрано" : "Клиент ещё не проходил колесо"}</p>
          )}
        </div>
      </div>

      {wheel ? (
        <>
          <div className="card-nested mt-3 rounded-[15px] p-2">
            <WheelChart result={wheel} size={248} />
          </div>
          <p className="mt-2.5 text-[11px] font-semibold leading-snug text-[var(--muted)]">{band.hint}</p>
          {lowest.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-black uppercase text-[var(--muted-2)]">Проседает:</span>
              {lowest.map((d) => <span key={d.key} className="chip" style={{ background: d.color }}>{d.short}</span>)}
            </div>
          )}
          <button onClick={() => { tap(); setOpen(!open); }} className="card-nested mt-3 flex w-full items-center justify-between px-3.5 py-2.5">
            <span className="text-[12px] font-black">Разбор по сферам</span>
            <ArrowGlyph className="transition-transform" style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)" }} />
          </button>
          <Disclosure open={open}>
            <div className="card-nested mt-2 p-3.5">
              <WheelBars result={wheel} />
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-[var(--muted)]">Собрано {dateF.format(new Date(wheel.completedAt))} · {subtitle}</p>
                {onStart && <button onClick={() => { tap(); onStart(); }} className="btn shrink-0 px-3 py-1 text-[10px]">Пройти заново</button>}
              </div>
            </div>
          </Disclosure>
        </>
      ) : onStart ? (
        <>
          <p className="t-sub mt-3">Посмотрите, где сейчас хватает опоры, а какие сферы жизни просят больше внимания. Результат сохранится в вашей динамике.</p>
          <button onClick={() => { tap(); onStart(); }} className="btn mt-2.5 w-full py-3"><Icon name="balance" width={17} weight="bold" color="#fff" /> Собрать колесо баланса</button>
        </>
      ) : (
        <p className="card-nested mt-3 p-3 text-[11px] font-semibold text-[var(--muted)]">Появится здесь, когда клиент соберёт колесо между сессиями.</p>
      )}
    </section>
  );
}
