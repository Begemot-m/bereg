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

  return (
    <div className="p-4" style={{ borderRadius: "var(--r-block)", background: "var(--surface)", boxShadow: "var(--shadow)" }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-bold">{MON[cursor.getMonth()]} {cursor.getFullYear()}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-2)]">‹</button>
          <button onClick={() => { setCursor(new Date()); onSelectDay(null); }} className="rounded-full px-2 py-1 text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)]">Сегодня</button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-2)]">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => <div key={d} className="pb-1 text-center text-[10px] font-bold text-[var(--muted-2)]">{d}</div>)}
        {cells.map((d, i) => {
          const y = ymdLocal(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isSel = selected === y;
          const isToday = y === todayY;
          return (
            <button
              key={i}
              onClick={() => { select(); onSelectDay(isSel ? null : y); }}
              className={`relative flex aspect-square items-center justify-center rounded-xl text-[13px] font-semibold transition-colors duration-150 ${inMonth ? "" : "opacity-30"}`}
              style={{ background: isSel ? "var(--a1)" : "transparent", color: isSel ? "#fff" : isToday ? "var(--a1-ink)" : "var(--ink)" }}
            >
              {d.getDate()}
              {has.has(y) && !isSel && <span className="absolute bottom-1 h-1 w-1 rounded-full" style={{ background: "var(--a1)" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
