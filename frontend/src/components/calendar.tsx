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

// Компактный месяц. avail — режим доступности окон (зелёное свободно / красное занято).
export function MonthCalendar({
  appts,
  selected,
  onSelectDay,
  avail,
  tone = "card",
}: {
  appts: Appointment[];
  selected: string | null;
  onSelectDay: (ymd: string | null) => void;
  avail?: Record<string, Avail>;
  tone?: "card" | "blend";
}) {
  const [cursor, setCursor] = useState(new Date());
  const has = new Set(appts.filter((a) => a.status !== "cancelled").map((a) => ymdLocal(new Date(a.startsAt))));
  const todayY = ymdLocal(new Date());

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  const navBtn = "flex h-8 w-8 items-center justify-center rounded-full stroke bg-white text-[16px] font-bold active:scale-90 transition-transform";
  return (
    <div className={tone === "blend" ? "px-1" : "chunk p-4"} style={tone === "blend" ? { background: "var(--page)" } : undefined}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-tight text-[16px] font-extrabold">{MON[cursor.getMonth()]} {cursor.getFullYear()}</p>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className={navBtn}>‹</button>
          <button onClick={() => { setCursor(new Date()); onSelectDay(null); }} className="rounded-full px-3 py-1 text-[12px] font-bold stroke bg-white active:scale-95 transition-transform">Сегодня</button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className={navBtn}>›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => <div key={d} className="pb-1 text-center text-[10px] font-extrabold uppercase text-[var(--muted-2)]">{d}</div>)}
        {cells.map((d, i) => {
          const y = ymdLocal(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isSel = selected === y;
          const isToday = y === todayY;
          const a: Avail | undefined = avail?.[y];

          let bg: string | undefined;
          let fg = "var(--ink)";
          if (!isSel && a === "free") { bg = "var(--green-soft)"; }
          else if (!isSel && a === "full") { bg = "var(--salmon-soft)"; fg = "rgba(32,28,24,.5)"; }

          const disabled = avail ? a !== "free" && !isSel : false;

          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => { select(); onSelectDay(isSel ? null : y); }}
              className={`relative flex aspect-square items-center justify-center rounded-full text-[13px] font-extrabold transition-transform duration-150 active:scale-90 ${inMonth ? "" : "opacity-25"} ${disabled ? "cursor-default" : ""}`}
              style={
                isSel
                  ? { background: "var(--ink)", color: "#fff", boxShadow: "0 0 0 var(--bw) var(--stroke)" }
                  : { background: bg, color: fg, border: (isToday && !bg) ? "var(--bw) solid var(--stroke)" : bg ? "var(--bw) solid var(--stroke)" : undefined }
              }
            >
              {d.getDate()}
              {!avail && has.has(y) && !isSel && <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)", border: "1px solid var(--stroke)" }} />}
            </button>
          );
        })}
      </div>
      {avail && (
        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] font-bold text-[var(--muted)]">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full stroke" style={{ background: "var(--green-soft)" }} /> свободно</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full stroke" style={{ background: "var(--salmon-soft)" }} /> занято</span>
        </div>
      )}
    </div>
  );
}
