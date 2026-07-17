"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Button, Spinner } from "@/components/ui";
import { select, success, tap } from "@/lib/haptics";
import { getWorkHours, saveWorkHours, WEEKDAYS, type WorkHours } from "@/lib/schedule";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const DURATIONS = [45, 50, 60, 90, 120];
const SPRING = { type: "spring" as const, stiffness: 480, damping: 26 };

// Конструктор окон: сначала параметры и «Собрать сетку», затем ручная лепка
// облачками-пузырьками (ползунок по минутам, микровибрация, пружинная анимация).
export function WorkHoursEditor({ onSaved }: { onSaved?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const [draft, setDraft] = useState<WorkHours | null>(null);
  const [day, setDay] = useState(0);
  const [from, setFrom] = useState(9);
  const [to, setTo] = useState(21);
  const [pick, setPick] = useState(10 * 60);
  const lastHaptic = useRef(0);
  useEffect(() => { if (data) setDraft(structuredClone(data)); }, [data]);

  const save = useMutation({
    mutationFn: () => saveWorkHours(draft!),
    onSuccess: () => { success(); qc.invalidateQueries({ queryKey: ["work-hours"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); onSaved?.(); },
  });

  if (isLoading || !draft) return <Spinner label="Окна" />;

  const dayHours = [...(draft.hours[day] ?? [])].sort();
  const setDayArr = (arr: string[]) => setDraft({ ...draft, hours: { ...draft.hours, [day]: [...new Set(arr)].sort() } });
  const addTime = (m: number) => { const t = hhmm(m); if (!dayHours.includes(t)) { success(); setDayArr([...dayHours, t]); } };
  const removeTime = (t: string) => { select(); setDayArr(dayHours.filter((x) => x !== t)); };
  const buildGrid = () => { select(); const step = draft.sessionMinutes; const out: string[] = []; for (let m = from * 60; m + step <= to * 60; m += step) out.push(hhmm(m)); setDayArr(out); };
  const copyTo = (n: number) => { tap(); const next = { ...draft.hours }; for (let d = 0; d < n; d++) next[d] = [...dayHours]; setDraft({ ...draft, hours: next }); };
  const clearDay = () => { select(); setDayArr([]); };

  const onSlide = (v: number) => { setPick(v); const now = Date.now(); if (now - lastHaptic.current > 55) { lastHaptic.current = now; select(); } };
  const bubbleScale = 0.9 + (pick / 1439) * 0.4;
  const pickExists = dayHours.includes(hhmm(pick));

  return (
    <div className="space-y-4">
      {/* Длина сессии */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-[var(--muted)]">Длина сессии</span>
        <div className="flex flex-wrap gap-1">
          {DURATIONS.map((d) => (
            <button key={d} onClick={() => { select(); setDraft({ ...draft, sessionMinutes: d }); }} className="rounded-full px-3 py-1 text-[12px] font-extrabold transition-transform active:scale-95 stroke" style={draft.sessionMinutes === d ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: "var(--muted)" }}>{d}м</button>
          ))}
        </div>
      </div>

      {/* Дни недели */}
      <div className="flex gap-1.5">
        {WEEKDAYS.map((label, wd) => {
          const cnt = (draft.hours[wd] ?? []).length;
          const isSel = day === wd;
          return (
            <button key={wd} onClick={() => { select(); setDay(wd); }} className="relative flex-1 rounded-[12px] py-2 text-[12px] font-extrabold transition-transform active:scale-95 stroke" style={isSel ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: cnt ? "var(--ink)" : "var(--muted-2)" }}>
              {label}
              {cnt > 0 && <motion.span key={cnt} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={SPRING} className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black stroke" style={{ background: "var(--head)", color: "var(--ink)", borderColor: "var(--edge)" }}>{cnt}</motion.span>}
            </button>
          );
        })}
      </div>

      {/* Шаг 1. Параметры + собрать сетку */}
      <div className="rounded-[16px] p-3 stroke" style={{ background: "var(--head-soft)" }}>
        <p className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Рабочий день</p>
        <div className="flex items-center gap-2">
          <TimeNum label="с" value={from} onChange={setFrom} />
          <TimeNum label="до" value={to} onChange={setTo} />
          <Button size="sm" className="ml-auto" onClick={buildGrid}>Собрать сетку</Button>
        </div>
      </div>

      {/* Шаг 2. Ручная лепка облачком-ползунком */}
      <div className="rounded-[16px] p-3.5 stroke" style={{ background: "#fff" }}>
        <p className="mb-3 text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Добавить окно вручную</p>
        <div className="flex flex-col items-center gap-3">
          <motion.button
            onClick={() => (pickExists ? removeTime(hhmm(pick)) : addTime(pick))}
            animate={{ scale: bubbleScale }}
            transition={SPRING}
            whileTap={{ scale: bubbleScale * 0.9 }}
            className="flex h-16 w-16 flex-col items-center justify-center rounded-full stroke"
            style={{ background: pickExists ? "var(--ink)" : "var(--head)", color: pickExists ? "#fff" : "var(--ink)", borderColor: pickExists ? "var(--ink)" : "var(--edge)" }}
          >
            <span className="font-tight text-[16px] font-extrabold leading-none tnum">{hhmm(pick)}</span>
            <span className="mt-0.5 text-[9px] font-bold uppercase opacity-70">{pickExists ? "убрать" : "＋ окно"}</span>
          </motion.button>
          <input
            type="range" min={0} max={1439} step={5} value={pick}
            onChange={(e) => onSlide(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{ accentColor: "var(--ink)", background: "var(--head-soft)", border: "var(--bw) solid var(--edge)" }}
          />
          <p className="text-[11px] font-semibold text-[var(--muted-2)]">Двигай ползунок и жми на облачко</p>
        </div>
      </div>

      {/* Окна дня — облачками */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[var(--muted)]">Окна · {WEEKDAYS[day]} · {dayHours.length}</span>
          {dayHours.length > 0 && <button onClick={clearDay} className="text-[12px] font-semibold text-[var(--muted-2)] hover:text-[var(--warn)]">Очистить</button>}
        </div>
        {dayHours.length === 0 ? (
          <div className="rounded-[14px] py-6 text-center text-[13px] font-semibold text-[var(--muted-2)] stroke" style={{ background: "#fff" }}>Пока пусто — соберите сетку или добавьте окно</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {dayHours.map((h) => (
                <motion.button
                  key={h}
                  layout
                  initial={{ scale: 0, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={SPRING}
                  onClick={() => removeTime(h)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-extrabold stroke"
                  style={{ background: "var(--head)", color: "var(--ink)", borderColor: "var(--edge)" }}
                >
                  {h}
                  <Icon name="plus" width={12} className="rotate-45 opacity-55" color="var(--ink)" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Перенос и сохранение */}
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" size="sm" onClick={() => copyTo(5)}>На будни</Button>
        <Button variant="soft" size="sm" onClick={() => copyTo(7)}>На все дни</Button>
        <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>{save.isSuccess ? "Сохранено" : "Сохранить"}</Button>
      </div>
    </div>
  );
}

function TimeNum({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[12px] font-bold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-1 rounded-full px-1.5 py-0.5 stroke" style={{ background: "#fff" }}>
        <button onClick={() => { select(); onChange(Math.max(0, value - 1)); }} className="text-[15px] font-bold leading-none">−</button>
        <span className="w-9 text-center text-[13px] font-extrabold tnum">{pad(value)}:00</span>
        <button onClick={() => { select(); onChange(Math.min(24, value + 1)); }} className="text-[15px] font-bold leading-none">＋</button>
      </div>
    </div>
  );
}
