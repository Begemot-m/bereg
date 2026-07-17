"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";

import { Icon } from "@/components/icons";
import { Button, Spinner } from "@/components/ui";
import { select, success } from "@/lib/haptics";
import { getWorkHours, saveWorkHours, WEEKDAYS, type WorkHours, type WorkSlot } from "@/lib/schedule";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const PXH = 40;
const STEP = 10;
const MAGNET = 13;
const SPRING = { type: "spring" as const, stiffness: 480, damping: 26 };

function snapMin(raw: number): number {
  const hour = Math.round(raw / 60) * 60;
  if (Math.abs(raw - hour) <= MAGNET) return hour;
  return Math.round(raw / STEP) * STEP;
}

const EDGE = 9; // мин — магнит к краю соседнего окна (чтобы липли вплотную)
type Span = { s: number; e: number };
// Притянуть к краям соседей и вытолкнуть из пересечений — окна встают впритык.
function resolveTouch(mins: number, dur: number, others: Span[]): number {
  for (const o of others) {
    if (Math.abs(mins - o.e) <= EDGE) mins = o.e;
    if (Math.abs(mins + dur - o.s) <= EDGE) mins = o.s - dur;
  }
  for (let i = 0; i < 4; i++) {
    let moved = false;
    for (const o of others) {
      if (mins < o.e && o.s < mins + dur) {
        const after = o.e, before = o.s - dur;
        mins = Math.abs(after - mins) <= Math.abs(before - mins) ? after : before;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return mins;
}

export function WorkHoursEditor({ onSaved }: { onSaved?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const [draft, setDraft] = useState<WorkHours | null>(null);
  const [day, setDay] = useState(0);
  const [from, setFrom] = useState(9);
  const [to, setTo] = useState(21);
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
  const overlaps = (mins: number, dur: number, others: Span[]) => others.some((o) => mins < o.e && o.s < mins + dur);

  const placeAt = (clientY: number) => {
    const rail = railRef.current; if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const others = slots.map((s) => ({ s: toMin(s.t), e: toMin(s.t) + s.d }));
    // Новая сессия магнитится к ровному часу (:00)
    let mins = Math.round((start + ((clientY - rect.top) / PXH) * 60) / 60) * 60;
    mins = clamp(resolveTouch(mins, len, others), start, end - len);
    if (overlaps(mins, len, others)) { select(); return; }
    success();
    setSlots([...slots, { t: hhmm(mins), d: len, fmt: "online" }]);
  };
  const toggleFmt = (t: string) => { select(); setSlots(slots.map((s) => (s.t === t ? { ...s, fmt: s.fmt === "online" ? "offline" : "online" } : s))); };
  const removeAt = (t: string) => { select(); setSlots(slots.filter((s) => s.t !== t)); };
  const commitMove = (s: WorkSlot, dyPx: number) => {
    const others = slots.filter((x) => x.t !== s.t).map((x) => ({ s: toMin(x.t), e: toMin(x.t) + x.d }));
    let mins = snapMin(toMin(s.t) + (dyPx / PXH) * 60);
    mins = clamp(resolveTouch(mins, s.d, others), start, end - s.d);
    if (overlaps(mins, s.d, others) || mins === toMin(s.t)) { if (mins !== toMin(s.t)) select(); return; }
    success();
    setSlots(slots.map((x) => (x.t === s.t ? { ...x, t: hhmm(mins) } : x)));
  };
  const copyTo = (n: number) => { select(); const next = { ...draft.hours }; for (let d = 0; d < n; d++) next[d] = slots.map((x) => ({ ...x })); setDraft({ ...draft, hours: next }); };

  return (
    <div className="space-y-3.5">
      {/* Интервал работы */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-[var(--muted)]">Работаю</span>
        <TimeNum label="с" value={from} onChange={(v) => setFrom(Math.min(v, to - 1))} />
        <TimeNum label="до" value={to} onChange={(v) => setTo(Math.max(v, from + 1))} />
      </div>

      {/* Длина сессии — ползунок с минутами на бегунке */}
      <div>
        <span className="text-[12px] font-bold text-[var(--muted)]">Длина новой сессии</span>
        <MinuteSlider value={len} onChange={(v) => setDraft({ ...draft, sessionMinutes: v })} />
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
              {slots.map((s) => (
                <SlotBlock
                  key={s.t}
                  label={`${s.t}–${hhmm(toMin(s.t) + s.d)}`}
                  evening={toMin(s.t) >= 18 * 60}
                  fmt={s.fmt}
                  top={((toMin(s.t) - start) / 60) * PXH}
                  height={(s.d / 60) * PXH - 3}
                  onRemove={() => removeAt(s.t)}
                  onToggleFmt={() => toggleFmt(s.t)}
                  onCommit={(dy) => commitMove(s, dy)}
                />
              ))}
            </AnimatePresence>
            {slots.length === 0 && <span className="pointer-events-none absolute inset-x-0 px-4 text-center text-[12px] font-semibold text-[var(--muted-2)]" style={{ top: PXH * 0.5 - 8 }}>Нажми, чтобы добавить сессию</span>}
          </div>
        </div>
      </div>

      <WeekMini hours={draft.hours} from={from} to={to} day={day} onPick={(d) => { select(); setDay(d); }} />

      <div className="flex flex-wrap gap-2">
        <Button variant="soft" size="sm" onClick={() => copyTo(5)}>На будни</Button>
        <Button variant="soft" size="sm" onClick={() => copyTo(7)}>На все дни</Button>
        <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>{save.isSuccess ? "Сохранено" : "Сохранить"}</Button>
      </div>
    </div>
  );
}

// Блок сам управляет своим сдвигом при драге — не перерисовывает весь редактор.
// Дневные окна светлее + солнце, вечерние (с 18:00) темнее + луна.
function SlotBlock({ label, evening, fmt, top, height, onRemove, onToggleFmt, onCommit }: { label: string; evening: boolean; fmt: "online" | "offline"; top: number; height: number; onRemove: () => void; onToggleFmt: () => void; onCommit: (dyPx: number) => void }) {
  const [dy, setDy] = useState(0);
  const drag = useRef<{ base: number; moved: boolean } | null>(null);
  const down = (e: RPointerEvent) => { e.stopPropagation(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); drag.current = { base: e.clientY, moved: false }; };
  const move = (e: RPointerEvent) => {
    const d = drag.current; if (!d) return;
    const off = e.clientY - d.base;
    if (!d.moved && Math.abs(off) > 4) { d.moved = true; select(); }
    if (d.moved) setDy(off);
  };
  const up = () => { const d = drag.current; drag.current = null; if (!d) return; if (!d.moved) { onRemove(); return; } onCommit(dy); setDy(0); };
  const bg = evening ? "var(--purple)" : "var(--head)";
  const bd = evening ? "var(--purple-edge)" : "var(--edge)";
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={SPRING}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onClick={(e) => e.stopPropagation()}
      className="absolute inset-x-1 flex touch-none items-center justify-center rounded-[10px] text-[12px] font-extrabold stroke"
      style={{ top: top + dy, height, background: bg, borderColor: bd, color: "var(--ink)", zIndex: dy ? 5 : 1, cursor: "grab" }}
    >
      {/* Мини-переключатель формата: тап переключает онлайн/очно */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggleFmt(); }}
        className="absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full stroke"
        style={{ background: "#fff" }}
        title={fmt === "online" ? "Онлайн" : "Очно"}
      >
        <Icon name={fmt === "online" ? "video" : "pin"} width={13} />
      </button>
      {label}
      <span className="pointer-events-none absolute right-1 top-1">
        <Icon name={evening ? "moon" : "sun"} width={12} weight="fill" color={evening ? "var(--purple-edge)" : "var(--amber-edge)"} />
      </span>
    </motion.div>
  );
}

// Ползунок с минутами прямо на бегунке.
function MinuteSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const MIN = 30, MAX = 120, S = 5;
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const last = useRef(0);
  const set = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    let p = (clientX - r.left) / r.width; p = clamp(p, 0, 1);
    const v = Math.round((MIN + p * (MAX - MIN)) / S) * S;
    if (v !== value) { const now = Date.now(); if (now - last.current > 35) { last.current = now; select(); } onChange(v); }
  };
  const pct = (value - MIN) / (MAX - MIN);
  return (
    <div
      ref={ref}
      onPointerDown={(e) => { dragging.current = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); set(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) set(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      className="relative mt-2 h-9 w-full cursor-pointer touch-none select-none"
    >
      <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full stroke" style={{ background: "var(--head-soft)" }} />
      <div className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full" style={{ left: 0, width: `${pct * 100}%`, background: "var(--head)" }} />
      <div className="absolute top-1/2 flex h-9 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[12px] font-extrabold" style={{ left: `${pct * 100}%`, background: "var(--ink)", color: "#fff", border: "var(--bw) solid var(--ink)" }}>{value}м</div>
    </div>
  );
}

const WeekMini = memo(function WeekMini({ hours, from, to, day, onPick }: { hours: Record<number, WorkSlot[]>; from: number; to: number; day: number; onPick: (d: number) => void }) {
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
                  const ev = toMin(s.t) >= 18 * 60;
                  return <div key={s.t} className="absolute inset-x-0.5 rounded-[3px]" style={{ top, height: h, background: ev ? "var(--purple)" : "var(--head)", border: `1px solid ${ev ? "var(--purple-edge)" : "var(--edge)"}` }} />;
                })}
              </div>
              <span className="text-[10px] font-extrabold uppercase" style={{ color: isSel ? "var(--ink)" : "var(--muted-2)" }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

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
