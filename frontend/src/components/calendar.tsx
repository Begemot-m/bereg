"use client";

import { useState } from "react";

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
}: {
  appts: Appointment[];
  selected: string | null;
  onSelectDay: (ymd: string | null) => void;
  avail?: Record<string, Avail>;
  tone?: "card" | "blend";
  disableUnavailable?: boolean;
}) {
  const [cursor, setCursor] = useState(new Date());
  const has = new Set(appts.filter((a) => a.status !== "cancelled").map((a) => ymdLocal(new Date(a.startsAt))));
  const todayY = ymdLocal(new Date());

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  const navBtn = "flex h-7 w-7 items-center justify-center rounded-full stroke bg-white text-[15px] font-bold active:scale-90 transition-transform";
  return (
    <div className={tone === "blend" ? "px-0.5" : "chunk p-3.5"} style={tone === "blend" ? { background: "transparent" } : undefined}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-tight text-[15px] font-extrabold">{MON[cursor.getMonth()]} {cursor.getFullYear()}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className={navBtn}>‹</button>
          <button onClick={() => { setCursor(new Date()); onSelectDay(null); }} className="rounded-full px-2.5 py-0.5 text-[11px] font-bold stroke bg-white active:scale-95 transition-transform">Сегодня</button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className={navBtn}>›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-x-1 gap-y-0.5">
        {WEEKDAYS.map((d) => <div key={d} className="pb-0.5 text-center text-[9px] font-extrabold uppercase text-[var(--muted-2)]">{d}</div>)}
        {cells.map((d, i) => {
          const y = ymdLocal(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isSel = selected === y;
          const isToday = y === todayY;
          const a: Avail | undefined = avail?.[y];

          let bg: string | undefined;
          let bd: string | undefined;
          let fg = "var(--ink)";
          if (!isSel && a === "free") { bg = "var(--green-soft)"; bd = "var(--green-edge)"; }
          else if (!isSel && a === "full") { bg = "var(--purple-soft)"; bd = "var(--purple-edge)"; fg = "rgba(32,28,24,.5)"; }
          else if (!isSel && isToday) { bg = "color-mix(in srgb, var(--head) 45%, transparent)"; }

          const disabled = disableUnavailable ? a !== "free" && !isSel : false;

          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => { select(); onSelectDay(isSel ? null : y); }}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] font-extrabold transition-transform duration-150 active:scale-90 ${inMonth ? "" : "opacity-25"} ${disabled ? "cursor-default" : ""}`}
              style={
                isSel
                  ? { background: "var(--head)", color: "var(--ink)", border: "var(--bw) solid var(--edge)" }
                  : { background: bg, color: fg, border: bd ? `var(--bw) solid ${bd}` : undefined }
              }
            >
              {d.getDate()}
              {!avail && has.has(y) && !isSel && <span className="absolute bottom-0.5 h-1 w-1 rounded-full" style={{ background: "var(--edge)" }} />}
            </button>
          );
        })}
      </div>
      {avail && (
        <div className="mt-2.5 flex items-center justify-center gap-4 text-[11px] font-bold text-[var(--muted)]">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }} /> свободно</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }} /> занято</span>
        </div>
      )}
    </div>
  );
}
