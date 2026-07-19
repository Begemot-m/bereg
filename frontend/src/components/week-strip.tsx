"use client";

import { useEffect, useMemo, useRef } from "react";

import { select } from "@/lib/haptics";
import { ymdLocal, WEEKDAYS } from "@/lib/schedule";

// Верхний календарь-стрип: свайп вбок с микровибрацией, выбранный день в оливковом круге.
export function WeekStrip({ selected, onSelect, marked, from = -3, days = 24 }: { selected?: string | null; onSelect?: (ymd: string) => void; marked?: Set<string>; from?: number; days?: number }) {
  const list = useMemo(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + from + i); return d; });
  }, [from, days]);

  const today = ymdLocal(new Date());
  const sel = selected ?? today;
  const selRef = useRef<HTMLButtonElement>(null);
  const lastHaptic = useRef(0);
  useEffect(() => { selRef.current?.scrollIntoView({ inline: "center", block: "nearest" }); }, []);

  const onScroll = () => {
    const now = Date.now();
    if (now - lastHaptic.current > 110) { lastHaptic.current = now; select(); }
  };

  return (
    <div className="relative">
      <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1" onScroll={onScroll} style={{ scrollSnapType: "x proximity" }}>
      {list.map((d) => {
        const key = ymdLocal(d);
        const active = key === sel;
        const isToday = key === today;
        const wd = (d.getDay() + 6) % 7;
        return (
          <button
            key={key}
            ref={active ? selRef : undefined}
            onClick={onSelect ? () => { select(); onSelect(key); } : undefined}
            className="flex w-11 shrink-0 flex-col items-center gap-1.5 rounded-full py-1.5"
            style={{ scrollSnapAlign: "center", border: active ? "var(--bw) solid var(--edge)" : isToday ? "var(--bw) dashed color-mix(in srgb, var(--edge) 55%, transparent)" : "var(--bw) solid transparent" }}
          >
            <span className="text-[10px] font-bold uppercase" style={{ color: "rgba(32,28,24,.55)" }}>{WEEKDAYS[wd]}</span>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-extrabold"
              style={active ? { background: "var(--head)", border: "var(--bw) solid var(--edge)", color: "var(--ink)" } : isToday ? { background: "color-mix(in srgb, var(--head) 45%, transparent)", color: "var(--ink)" } : { color: "var(--ink)" }}
            >
              {d.getDate()}
            </span>
            <span className="flex h-1.5 items-center justify-center">{marked?.has(key) && <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "var(--ink)" : "var(--edge)" }} />}</span>
          </button>
        );
      })}
      </div>
      {/* Аккуратная подсказка: края тают + еле заметный шеврон «листай» */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-5" style={{ background: "linear-gradient(to left, transparent, var(--page))" }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-end pb-1 pr-0.5" style={{ background: "linear-gradient(to right, transparent, var(--page))" }}>
        <span className="hint-slide text-[15px] font-bold" style={{ color: "var(--edge)" }}>›</span>
      </div>
    </div>
  );
}
