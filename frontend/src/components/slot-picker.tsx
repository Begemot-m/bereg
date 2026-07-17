"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { MonthCalendar } from "@/components/calendar";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { select, tap } from "@/lib/haptics";
import { getMonthAvailability, getSlots, WEEKDAYS, ymdLocal, type Slot } from "@/lib/schedule";
import type { ApptFormat } from "@/lib/appointments";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const monShort = new Intl.DateTimeFormat("ru-RU", { month: "short" });

// Лента дней (или мини-календарик) + сетка свободных времён. Формат берётся из окна.
export function SlotPicker({
  forClient = false,
  daysAhead = 21,
  variant = "strip",
  showAvail = false,
  onPick,
}: {
  forClient?: boolean;
  daysAhead?: number;
  variant?: "strip" | "calendar";
  showAvail?: boolean;
  onPick: (iso: string, format: ApptFormat) => void;
}) {
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: daysAhead }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [daysAhead]);

  const [active, setActive] = useState(() => ymdLocal(days[0]));

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["slots", active, forClient],
    queryFn: () => getSlots(active, forClient),
  });

  const { data: avail } = useQuery({
    queryKey: ["month-avail", forClient],
    queryFn: () => getMonthAvailability(forClient),
    enabled: variant === "calendar" && showAvail,
  });

  const free = slots.filter((s) => !s.taken);

  return (
    <div>
      {variant === "calendar" ? (
        <MonthCalendar appts={[]} selected={active} onSelectDay={(y) => y && setActive(y)} avail={showAvail ? avail : undefined} disableUnavailable={showAvail} />
      ) : (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d) => {
            const key = ymdLocal(d);
            const isActive = key === active;
            const wd = (d.getDay() + 6) % 7;
            const today = ymdLocal(new Date()) === key;
            return (
              <button
                key={key}
                onClick={() => { select(); setActive(key); }}
                className="flex h-[68px] w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[16px] transition-transform duration-150 active:scale-95 stroke"
                style={isActive ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: "var(--ink)" }}
              >
                <span className={`text-[10px] font-extrabold uppercase ${isActive ? "opacity-90" : "text-[var(--muted-2)]"}`}>{WEEKDAYS[wd]}</span>
                <span className="text-[18px] font-extrabold leading-none">{d.getDate()}</span>
                <span className={`text-[9px] font-bold ${isActive ? "opacity-80" : "text-[var(--muted-2)]"}`}>
                  {today ? "сегодня" : monShort.format(d).replace(".", "")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Времена */}
      <div className="mt-4 min-h-[64px]">
        {isLoading ? (
          <Spinner label="Свободные окна" />
        ) : free.length === 0 ? (
          <p className="py-3 text-[13px] font-semibold text-[var(--muted-2)]">На этот день свободных окон нет.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {free.map((s: Slot) => (
              <button
                key={s.start}
                onClick={() => { tap(); onPick(s.start, s.fmt); }}
                className="flex items-center justify-center gap-1 rounded-[12px] py-2.5 text-[13px] font-extrabold transition-transform duration-150 active:scale-95 stroke"
                style={{ background: "#fff", color: "var(--ink)" }}
              >
                <Icon name={s.fmt === "online" ? "video" : "pin"} width={12} />{timeF.format(new Date(s.start))}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
