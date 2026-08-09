"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { MonthCalendar } from "@/components/calendar";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { select, tap } from "@/lib/haptics";
import { getMonthAvailability, getSlots, WEEKDAYS, ymdLocal, type Slot } from "@/lib/schedule";
import type { Appointment, ApptFormat } from "@/lib/appointments";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const monShort = new Intl.DateTimeFormat("ru-RU", { month: "short" });

// Лента дней (или мини-календарик) + сетка свободных времён. Формат берётся из окна.
export function SlotPicker({
  psyId,
  daysAhead = 21,
  variant = "strip",
  showAvail = false,
  calendarTone = "card",
  startDay,
  appts = [],
  bookedStart,
  bookedLabel,
  onPick,
}: {
  /** Чьи окна показываем. Без id — своё расписание, с id — расписание специалиста. */
  psyId?: number | null;
  daysAhead?: number;
  variant?: "strip" | "calendar";
  showAvail?: boolean;
  calendarTone?: "card" | "blend";
  /** Записи, которые нужно отметить в календаре как занятые дни. */
  appts?: Appointment[];
  /** День, с которого открываемся: обычно ближайший со свободным окном. */
  startDay?: string;
  /** Окно текущей записи — показываем его в сетке времён с акцентом. */
  bookedStart?: string;
  bookedLabel?: string;
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

  const [active, setActive] = useState(() => startDay ?? ymdLocal(days[0]));
  // Ближайший свободный день приходит асинхронно — перескакиваем на него,
  // пока пользователь сам не выбрал другой.
  const touched = useRef(false);
  useEffect(() => { if (startDay && !touched.current) setActive(startDay); }, [startDay]);

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["slots", active, psyId ?? null],
    queryFn: () => getSlots(active, psyId),
  });

  const { data: avail } = useQuery({
    queryKey: ["month-avail", psyId ?? null],
    queryFn: () => getMonthAvailability(psyId),
    enabled: variant === "calendar" && showAvail,
  });

  const free = slots.filter((s) => !s.taken);
  // Окно текущей записи занято, в свободные не попадает — показываем его отдельно,
  // чтобы психолог видел, откуда переносит.
  const showBooked = !!bookedStart && ymdLocal(new Date(bookedStart)) === active;

  return (
    <div>
      {variant === "calendar" ? (
        <MonthCalendar appts={appts} selected={active} onSelectDay={(y) => { if (y) { touched.current = true; setActive(y); } }} avail={showAvail ? avail : undefined} disableUnavailable={showAvail} tone={calendarTone} />
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
                onClick={() => { select(); touched.current = true; setActive(key); }}
                className="flex h-[68px] w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[14px] transition-transform duration-150 active:scale-95 stroke"
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
        ) : free.length === 0 && !showBooked ? (
          <p className="py-3 text-[13px] font-semibold text-[var(--muted-2)]">На этот день свободных окон нет.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {showBooked && bookedStart && (
              <div className="col-span-3 flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2.5 text-[13px] font-black text-[var(--ink)]" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }}>
                <Icon name="check" width={13} weight="bold" color="var(--green-edge)" />
                <span className="truncate">{bookedLabel ?? "Текущая запись"}</span>
                <span className="tnum">· {timeF.format(new Date(bookedStart))}</span>
              </div>
            )}
            {free.map((s: Slot) => (
              <button
                key={s.start}
                onClick={() => { tap(); onPick(s.start, s.fmt); }}
                className="flex flex-col items-center justify-center gap-0.5 rounded-[12px] py-2.5 text-[14px] font-black transition-transform duration-150 active:scale-95"
                style={{ background: "#fff", border: "var(--bw) solid var(--edge)", color: "var(--ink)" }}
              >
                <span className="tnum">{timeF.format(new Date(s.start))}</span>
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[.04em] text-[var(--edge)]"><Icon name={s.fmt === "online" ? "video" : "pin"} width={10} weight="bold" />{s.fmt === "online" ? "онлайн" : "очно"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
