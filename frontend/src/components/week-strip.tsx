"use client";

import { useEffect, useMemo, useRef } from "react";

import { select } from "@/lib/haptics";
import { ymdLocal, WEEKDAYS } from "@/lib/schedule";

// Верхний календарь-стрип: дни со свайпом вбок, выбранный — в чёрном круге.
export function WeekStrip({ selected, onSelect, from = -3, days = 24 }: { selected?: string | null; onSelect?: (ymd: string) => void; from?: number; days?: number }) {
  const list = useMemo(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + from + i); return d; });
  }, [from, days]);

  const sel = selected ?? ymdLocal(new Date());
  const selRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { selRef.current?.scrollIntoView({ inline: "center", block: "nearest" }); }, []);

  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1">
      {list.map((d) => {
        const key = ymdLocal(d);
        const active = key === sel;
        const wd = (d.getDay() + 6) % 7;
        return (
          <button
            key={key}
            ref={active ? selRef : undefined}
            onClick={onSelect ? () => { select(); onSelect(key); } : undefined}
            className="flex w-11 shrink-0 flex-col items-center gap-1.5"
          >
            <span className="text-[10px] font-bold uppercase" style={{ color: "rgba(32,28,24,.55)" }}>{WEEKDAYS[wd]}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-extrabold" style={active ? { background: "var(--ink)", color: "#fff", border: "var(--bw) solid var(--stroke)" } : { color: "var(--ink)" }}>
              {d.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
