"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DaySlots } from "@/components/day-slots";
import { listAppointments } from "@/lib/appointments";
import { select } from "@/lib/haptics";
import { getWorkHours, WEEKDAYS } from "@/lib/schedule";

// Готовый недельный график окон: обзор недели + слоты выбранного дня.
export function WeekWindows() {
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const [sel, setSel] = useState(0);

  const counts = (d: Date) => {
    const wd = (d.getDay() + 6) % 7;
    const now = Date.now();
    let free = 0, busy = 0;
    for (const s of work?.hours?.[wd] ?? []) {
      const [hh, mm] = s.t.split(":").map(Number);
      const dt = new Date(d); dt.setHours(hh, mm, 0, 0);
      const appt = appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime());
      if (appt) busy++; else if (dt.getTime() >= now) free++;
    }
    return { free, busy };
  };

  const hasWork = Object.values(work?.hours ?? {}).some((a) => (a ?? []).length > 0);
  if (!hasWork) {
    return (
      <div className="rounded-[14px] py-6 text-center text-[13px] font-semibold text-[var(--muted)] stroke" style={{ background: "#fff" }}>
        Окна ещё не заданы.<br /><Link href="/cabinet" className="font-extrabold underline">Настроить график в кабинете →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Обзор недели */}
      <div className="flex gap-1.5">
        {days.map((d, i) => {
          const { free, busy } = counts(d);
          const isSel = i === sel;
          const wd = (d.getDay() + 6) % 7;
          return (
            <button key={i} onClick={() => { select(); setSel(i); }} className="flex flex-1 flex-col items-center gap-1 rounded-[11px] py-1.5 stroke" style={isSel ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff" }}>
              <span className="text-[9px] font-extrabold uppercase opacity-70">{WEEKDAYS[wd]}</span>
              <span className="text-[15px] font-extrabold leading-none">{d.getDate()}</span>
              <span className="flex gap-0.5">
                {free > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--green)", border: "1px solid var(--green-edge)" }} />}
                {busy > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--purple)", border: "1px solid var(--purple-edge)" }} />}
                {free + busy === 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--edge-neutral)" }} />}
              </span>
            </button>
          );
        })}
      </div>

      <DaySlots date={days[sel]} />
    </div>
  );
}
