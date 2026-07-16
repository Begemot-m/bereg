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

// Компактный месяц: точки на днях с записями, выбор дня фильтрует список.
export function MonthCalendar({ appts, selected, onSelectDay }: { appts: Appointment[]; selected: string | null; onSelectDay: (ymd: string | null) => void }) {
  const [cursor, setCursor] = useState(new Date());
  const has = new Set(appts.filter((a) => a.status !== "cancelled").map((a) => ymdLocal(new Date(a.startsAt))));
  const todayY = ymdLocal(new Date());

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  const navBtn = "flex h-8 w-8 items-center justify-center rounded-full stroke bg-white text-[16px] font-bold active:scale-90 transition-transform";
  return (
    <div className="chunk p-4">
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
          return (
            <button
              key={i}
              onClick={() => { select(); onSelectDay(isSel ? null : y); }}
              className={`relative flex aspect-square items-center justify-center rounded-full text-[13px] font-extrabold transition-transform duration-150 active:scale-90 ${inMonth ? "" : "opacity-25"}`}
              style={isSel ? { background: "var(--ink)", color: "#fff", border: "var(--bw) solid var(--stroke)" } : isToday ? { border: "var(--bw) solid var(--stroke)" } : undefined}
            >
              {d.getDate()}
              {has.has(y) && !isSel && <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)", border: "1px solid var(--stroke)" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
