"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";

import { Button, Spinner } from "@/components/ui";
import { select, success } from "@/lib/haptics";
import { getWorkHours, saveWorkHours, WEEKDAYS, type WorkHours, type WorkSlot } from "@/lib/schedule";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const PXH = 40;   // высота часа
const STEP = 10;  // базовая сетка, мин
const MAGNET = 13; // сила притяжения к ровному часу, мин
const SPRING = { type: "spring" as const, stiffness: 480, damping: 26 };

// Магнитная привязка: близко к ровному часу — прилипает к :00, иначе шаг 10 мин.
function snapMin(raw: number): number {
  const hour = Math.round(raw / 60) * 60;
  if (Math.abs(raw - hour) <= MAGNET) return hour;
  return Math.round(raw / STEP) * STEP;
}

export function WorkHoursEditor({ onSaved }: { onSaved?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const [draft, setDraft] = useState<WorkHours | null>(null);
  const [day, setDay] = useState(0);
  const [from, setFrom] = useState(9);
  const [to, setTo] = useState(21);
  const [drag, setDrag] = useState<{ t: string; base: number; dy: number; moved: boolean } | null>(null);
  const lastHaptic = useRef(0);
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (data) setDraft(structuredClone(data)); }, [data]);

  const save = useMutation({
    mutationFn: () => saveWorkHours(draft!),
    onSuccess: () => { success(); qc.invalidateQueries({ queryKey: ["work-hours"] }); qc.invalidateQueries({ queryKey: ["slots"] }); qc.invalidateQueries({ queryKey: ["month-avail"] }); onSaved?.(); },
  });

  if (isLoading || !draft) return <Spinner label="Окна" />;

  const len = draft.sessionMinutes;
  const start = from * 60;
  const end = to * 60;
  const railH = Math.max(1, to - from) * PXH;
  const slots = [...(draft.hours[day] ?? [])].sort((a, b) => a.t.localeCompare(b.t));
  const setSlots = (arr: WorkSlot[]) => setDraft({ ...draft, hours: { ...draft.hours, [day]: [...arr].sort((a, b) => a.t.localeCompare(b.t)) } });

  const setLen = (v: number) => { setDraft({ ...draft, sessionMinutes: v }); const now = Date.now(); if (now - lastHaptic.current > 55) { lastHaptic.current = now; select(); } };
  const fits = (mins: number, dur: number, ignoreT?: string) => !slots.some((s) => s.t !== ignoreT && mins < toMin(s.t) + s.d && toMin(s.t) < mins + dur);

  const placeAt = (clientY: number) => {
    const rail = railRef.current; if (!rail) return;
    const rect = rail.getBoundingClientRect();
    let mins = snapMin(start + ((clientY - rect.top) / PXH) * 60);
    mins = clamp(mins, start, end - len);
    if (!fits(mins, len)) { select(); return; }
    success();
    setSlots([...slots, { t: hhmm(mins), d: len }]);
  };
  const removeAt = (t: string) => { select(); setSlots(slots.filter((s) => s.t !== t)); };
  const copyTo = (n: number) => { select(); const next = { ...draft.hours }; for (let d = 0; d < n; d++) next[d] = slots.map((s) => ({ ...s })); setDraft({ ...draft, hours: next }); };

  // Перетаскивание блока по вертикали
  const onDown = (s: WorkSlot, e: RPointerEvent) => { e.stopPropagation(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setDrag({ t: s.t, base: e.clientY, dy: 0, moved: false }); };
  const onMove = (e: RPointerEvent) => { if (!drag) return; const dy = e.clientY - drag.base; const moved = drag.moved || Math.abs(dy) > 4; if (moved && !drag.moved) select(); setDrag({ ...drag, dy, moved }); };
  const onUp = (s: WorkSlot) => {
    if (!drag) return;
    if (!drag.moved) { removeAt(s.t); setDrag(null); return; }
    const raw = toMin(s.t) + (drag.dy / PXH) * 60;
    const ns = clamp(snapMin(raw), start, end - s.d);
    if (fits(ns, s.d, s.t)) { success(); setSlots(slots.map((x) => (x.t === s.t ? { ...x, t: hhmm(ns) } : x))); }
    else select();
    setDrag(null);
  };

  return (
    <div className="space-y-3.5">
      {/* Интервал работы */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-[var(--muted)]">Работаю</span>
        <TimeNum label="с" value={from} onChange={(v) => setFrom(Math.min(v, to - 1))} />
        <TimeNum label="до" value={to} onChange={(v) => setTo(Math.max(v, from + 1))} />
      </div>

      {/* Длина сессии ползунком */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12px] font-bold text-[var(--muted)]">Длина новой сессии</span>
          <motion.span key={len} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={SPRING} className="rounded-full px-3 py-0.5 text-[13px] font-extrabold stroke" style={{ background: "var(--head)", borderColor: "var(--edge)" }}>{len} мин</motion.span>
        </div>
        <input type="range" min={30} max={120} step={5} value={len} onChange={(e) => setLen(Number(e.target.value))} className="h-2.5 w-full cursor-pointer appearance-none rounded-full" style={{ accentColor: "var(--ink)", background: "var(--head-soft)", border: "var(--bw) solid var(--edge)" }} />
      </div>

      {/* Дни недели */}
      <div className="flex gap-1.5">
        {WEEKDAYS.map((label, wd) => {
          const cnt = (draft.hours[wd] ?? []).length;
          const isSel = day === wd;
          return (
            <button key={wd} onClick={() => { select(); setDay(wd); }} className="relative flex-1 rounded-[11px] py-1.5 text-[12px] font-extrabold transition-transform active:scale-95 stroke" style={isSel ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff", color: cnt ? "var(--ink)" : "var(--muted-2)" }}>
              {label}
              {cnt > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black stroke" style={{ background: "var(--head)", color: "var(--ink)", borderColor: "var(--edge)" }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* График дня */}
      <div>
        <p className="mb-2 text-[12px] font-semibold text-[var(--muted)]">Тап — поставить · тяни блок — сдвинуть · тап по блоку — убрать</p>
        <div className="flex gap-2">
          <div className="relative w-9 shrink-0" style={{ height: railH }}>
            {Array.from({ length: to - from + 1 }, (_, i) => (
              <span key={i} className="absolute right-1 -translate-y-1/2 text-[10px] font-bold text-[var(--muted-2)] tnum" style={{ top: i * PXH }}>{pad(from + i)}:00</span>
            ))}
          </div>
          <div ref={railRef} onClick={(e) => placeAt(e.clientY)} className="relative flex-1 overflow-hidden rounded-[14px] stroke" style={{ height: railH, background: "#fff" }}>
            {Array.from({ length: Math.max(0, to - from) }, (_, i) => (
              <div key={i} className="absolute inset-x-0" style={{ top: (i + 1) * PXH, borderTop: "1px solid var(--edge-neutral)" }} />
            ))}
            <AnimatePresence>
              {slots.map((s) => {
                const dy = drag?.t === s.t ? drag.dy : 0;
                return (
                  <motion.div
                    key={s.t}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={SPRING}
                    onPointerDown={(e) => onDown(s, e)}
                    onPointerMove={onMove}
                    onPointerUp={() => onUp(s)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-x-1 flex touch-none items-center justify-center rounded-[10px] text-[12px] font-extrabold stroke"
                    style={{ top: ((toMin(s.t) - start) / 60) * PXH + dy, height: (s.d / 60) * PXH - 3, background: "var(--head)", borderColor: "var(--edge)", color: "var(--ink)", zIndex: drag?.t === s.t ? 5 : 1, cursor: "grab" }}
                  >
                    {s.t}–{hhmm(toMin(s.t) + s.d)}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {slots.length === 0 && <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] font-semibold text-[var(--muted-2)]">Пусто — тапни по времени</span>}
          </div>
        </div>
      </div>

      {/* Мини-график недели */}
      <WeekMini hours={draft.hours} from={from} to={to} day={day} onPick={(d) => { select(); setDay(d); }} />

      {/* Перенос и сохранение */}
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" size="sm" onClick={() => copyTo(5)}>На будни</Button>
        <Button variant="soft" size="sm" onClick={() => copyTo(7)}>На все дни</Button>
        <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>{save.isSuccess ? "Сохранено" : "Сохранить"}</Button>
      </div>
    </div>
  );
}

function WeekMini({ hours, from, to, day, onPick }: { hours: Record<number, WorkSlot[]>; from: number; to: number; day: number; onPick: (d: number) => void }) {
  const H = 60;
  const span = Math.max(1, to - from) * 60;
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Неделя</p>
      <div className="flex gap-1.5">
        {WEEKDAYS.map((label, wd) => {
          const list = hours[wd] ?? [];
          const isSel = wd === day;
          return (
            <button key={wd} onClick={() => onPick(wd)} className="flex flex-1 flex-col items-center gap-1">
              <div className="relative w-full overflow-hidden rounded-[8px] stroke" style={{ height: H, background: "#fff", borderColor: isSel ? "var(--ink)" : undefined, borderWidth: isSel ? 2 : undefined }}>
                {list.map((s) => {
                  const top = clamp(((toMin(s.t) - from * 60) / span) * H, 0, H);
                  const h = Math.max(3, (s.d / span) * H);
                  return <div key={s.t} className="absolute inset-x-0.5 rounded-[3px]" style={{ top, height: h, background: "var(--head)", border: "1px solid var(--edge)" }} />;
                })}
              </div>
              <span className="text-[10px] font-extrabold uppercase" style={{ color: isSel ? "var(--ink)" : "var(--muted-2)" }}>{label}</span>
            </button>
          );
        })}
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
