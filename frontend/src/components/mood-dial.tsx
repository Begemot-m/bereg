"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { MoodEgg, moodColor } from "@/components/mood-egg";
import { suggestFamilies } from "@/lib/emotions";
import { select, success, tap, tick } from "@/lib/haptics";
import { MOOD_LABEL } from "@/lib/mascots";

const TICK = 14;      // шаг риски, px
const STEPS = 41;     // 1.0 … 5.0 с шагом 0.1
const MAX_EMOTIONS = 4;

// Миниатюра на главной и в терапии: открывает окно отметки.
export function MoodCard({ mood, emotions, onOpen }: { mood?: number; emotions?: string[]; onOpen: () => void }) {
  const value = mood ?? 3;
  return (
    <button
      onClick={() => { tap(); onOpen(); }}
      className="relative w-full overflow-hidden rounded-[22px] p-4 text-left transition-transform duration-200 active:scale-[0.99]"
      style={{ background: mood ? `${moodColor(value)}33` : "var(--amber-soft)", border: `var(--bw-lg) solid ${mood ? moodColor(value) : "var(--amber-edge)"}` }}
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0"><MoodEgg value={value} size={62} still /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-black leading-tight">Какое у вас настроение сегодня?</span>
          <span className="mt-1 block truncate text-[11.5px] font-bold text-[var(--muted)]">
            {mood ? [MOOD_LABEL[Math.round(value)], ...(emotions ?? [])].join(" · ") : "Покрутите диск — и отметьте эмоцию дня"}
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[18px] font-black text-white">›</span>
      </div>
    </button>
  );
}

// Окно отметки: персонаж + диск-скролл + базовые эмоции под выбранным уровнем.
export function MoodSheet({ open, mood, emotions, onClose, onSave }: {
  open: boolean;
  mood?: number;
  emotions?: string[];
  onClose: () => void;
  onSave: (mood: number, emotions: string[]) => void;
}) {
  const [value, setValue] = useState(mood ?? 3);
  const [picked, setPicked] = useState<string[]>(emotions ?? []);
  const track = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const lastLevel = useRef(Math.round(mood ?? 3));
  const level = Math.round(value);

  useEffect(() => {
    if (!open) return;
    setValue(mood ?? 3);
    setPicked(emotions ?? []);
    lastLevel.current = Math.round(mood ?? 3);
    const el = track.current;
    if (el) requestAnimationFrame(() => { el.scrollLeft = Math.round(((mood ?? 3) - 1) * 10) * TICK; });
    return () => cancelAnimationFrame(frame.current);
  }, [open, mood, emotions]);

  // Читаем позицию раз в кадр — иначе на каждый scroll-event идёт лишний рендер.
  const onScroll = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = track.current;
      if (!el) return;
      const next = 1 + Math.min(STEPS - 1, Math.max(0, Math.round(el.scrollLeft / TICK))) / 10;
      setValue(next);
      const rounded = Math.round(next);
      if (rounded !== lastLevel.current) { lastLevel.current = rounded; tick(); }
    });
  };

  const toggle = (name: string) => {
    select();
    setPicked((cur) => cur.includes(name) ? cur.filter((item) => item !== name) : cur.length < MAX_EMOTIONS ? [...cur, name] : cur);
  };

  const close = () => { cancelAnimationFrame(frame.current); frame.current = 0; onClose(); };

  if (!open) return null;

  const families = suggestFamilies(level);
  const tint = moodColor(value);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "var(--surface)" }}>
      {/* Подсветка сверху — в цвет выбранного настроения */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%]" style={{ background: `linear-gradient(180deg, ${tint} 0%, transparent 100%)`, opacity: 0.42 }} />

      <div className="relative flex items-center justify-between px-4 pt-4">
        <button onClick={() => { tap(); close(); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[20px] font-black stroke" aria-label="Закрыть">‹</button>
        <p className="text-[11px] font-black uppercase tracking-[.12em] text-[var(--muted)]">Эмоция дня</p>
        <span className="w-10" />
      </div>

      <div className="relative flex flex-1 flex-col overflow-y-auto px-4 pb-8">
        <h2 className="mt-4 text-center font-tight text-[26px] font-black leading-tight">Какое у вас настроение<br />сегодня?</h2>

        <div className="mt-2 flex justify-center"><MoodEgg value={value} size={172} /></div>

        <p className="mt-1 text-center text-[20px] font-black capitalize">{MOOD_LABEL[level]}</p>

        {/* Диск-скролл: влево — тяжело, вправо — хорошо */}
        <div className="relative mt-4">
          <div ref={track} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain py-2">
            <span className="shrink-0" style={{ width: "calc(50% - 7px)" }} />
            {Array.from({ length: STEPS }).map((_, index) => {
              const major = index % 10 === 0;
              return (
                <span key={index} className="flex shrink-0 snap-center items-center justify-center" style={{ width: TICK, height: 44 }}>
                  <i className="block rounded-full" style={{ width: major ? 3 : 2, height: major ? 30 : 15, background: major ? "var(--ink)" : "var(--muted-2)", opacity: major ? 0.85 : 0.4 }} />
                </span>
              );
            })}
            <span className="shrink-0" style={{ width: "calc(50% - 7px)" }} />
          </div>
          <span className="pointer-events-none absolute left-1/2 top-0 h-[48px] w-[4px] -translate-x-1/2 rounded-full" style={{ background: tint, boxShadow: "0 0 0 2px var(--ink)" }} />
          <div className="mt-1 flex justify-between px-1 text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted-2)]">
            <span>тяжело</span><span>отлично</span>
          </div>
        </div>

        {/* Базовые эмоции под выбранным уровнем */}
        <div className="mt-5">
          <p className="text-[11px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Что именно вы чувствуете?</p>
          <div className="mt-2.5 space-y-3">
            {families.map((family) => (
              <div key={family.key}>
                <p className="mb-1.5 text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted-2)]">{family.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {family.items.map((name) => {
                    const on = picked.includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() => toggle(name)}
                        aria-pressed={on}
                        className="rounded-full px-3 py-1.5 text-[12px] font-black transition-transform active:scale-95"
                        style={{ background: on ? `var(--${family.tone})` : "#fff", border: `var(--bw) solid var(--${on ? `${family.tone}-edge` : "edge-neutral"})`, color: on ? "var(--ink)" : "var(--muted)" }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[10px] font-semibold text-[var(--muted-2)]">Первичные эмоции по колесу Плутчика — от слабой к сильной. До {MAX_EMOTIONS} отметок.</p>
        </div>
      </div>

      <div className="relative px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2">
        <button
          onClick={() => { success(); onSave(level, picked); close(); }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] py-3.5 text-[14px] font-black text-white transition-transform active:scale-[0.98]"
        >
          <Icon name="check" width={17} weight="bold" color="#fff" /> Сохранить эмоцию дня
        </button>
      </div>
    </div>
  );
}
