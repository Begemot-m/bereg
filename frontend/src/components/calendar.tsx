"use client";

import { useState } from "react";
import { ArrowGlyph } from "@/components/blocks";

import { select } from "@/lib/haptics";
import { ymdLocal, WEEKDAYS } from "@/lib/schedule";
import type { Appointment } from "@/lib/appointments";

const MON = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

type Avail = "free" | "full" | "none";

// Компактный месяц. avail — доступность (зелёное свободно / красное занято).
export function MonthCalendar({
  appts,
  selected,
  onSelectDay,
  avail,
  tone = "card",
  disableUnavailable = false,
  multi,
  onToggle,
}: {
  appts: Appointment[];
  selected: string | null;
  onSelectDay: (ymd: string | null) => void;
  avail?: Record<string, Avail>;
  tone?: "card" | "blend";
  disableUnavailable?: boolean;
  multi?: Set<string>;
  onToggle?: (ymd: string) => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const has = new Set(appts.filter((a) => a.status !== "cancelled").map((a) => ymdLocal(new Date(a.startsAt))));
  const todayY = ymdLocal(new Date());

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  const navBtn = "arrow active:scale-90";
  return (
    <div className={tone === "blend" ? "px-0.5" : "chunk p-3.5"} style={tone === "blend" ? { background: "transparent" } : undefined}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-tight text-[15px] font-extrabold">{MON[cursor.getMonth()]} {cursor.getFullYear()}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className={navBtn}><ArrowGlyph style={{ transform: "rotate(180deg)" }} /></button>
          <button onClick={() => { setCursor(new Date()); onSelectDay(null); }} className="rounded-full px-2.5 py-1 text-[11px] font-bold active:scale-95 transition-transform" style={{ background: "var(--head-soft)", color: "var(--edge)" }}>Сегодня</button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className={navBtn}><ArrowGlyph /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-x-1 gap-y-0.5">
        {WEEKDAYS.map((d) => <div key={d} className="pb-0.5 text-center text-[9px] font-extrabold uppercase text-[var(--muted-2)]">{d}</div>)}
        {cells.map((d, i) => {
          const y = ymdLocal(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isSel = multi ? multi.has(y) : selected === y;
          const isToday = y === todayY;
          const a: Avail | undefined = avail?.[y];

          // Различимые состояния: занят — фиолетовая заливка с обводкой,
          // свободен — зелёный контур (как плитки окон), обычный день — без заливки.
          // Сегодня — тёмное кольцо, выбранный — сплошная тёмная заливка.
          const busy = has.has(y) || a === "full";
          const free = !busy && a === "free";
          const disabled = disableUnavailable ? a !== "free" && !isSel : false;

          let base: React.CSSProperties = { color: "var(--ink)" };
          if (busy) base = { background: "var(--purple)", color: "#3b2c55", border: "var(--bw) solid var(--purple-edge)" };
          else if (free) base = { background: "var(--green-soft)", color: "var(--ink)", border: "var(--bw) solid var(--green-edge)" };

          // Кольцо «сегодня» — обводкой, а не тенью: теней в системе нет.
          const style: React.CSSProperties = isSel
            ? { background: "var(--ink)", color: "#fff", border: "var(--bw) solid var(--ink)" }
            : { ...base, outline: isToday ? "2px solid var(--ink)" : undefined, outlineOffset: "1px" };

          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => { select(); if (multi) onToggle?.(y); else onSelectDay(isSel ? null : y); }}
              className={`keep-ring relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] font-extrabold transition-colors duration-150 active:scale-90 ${inMonth ? "" : "opacity-25"} ${disabled ? "cursor-default" : ""}`}
              style={style}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-[11px] font-bold text-[var(--muted)]">
        {avail && <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }} /> свободно</span>}
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full" style={{ background: "var(--purple)", border: "var(--bw) solid var(--purple-edge)" }} /> есть записи</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full bg-white" style={{ outline: "2px solid var(--ink)", outlineOffset: "-2px" }} /> сегодня</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full" style={{ background: "var(--ink)" }} /> выбран</span>
      </div>
    </div>
  );
}
