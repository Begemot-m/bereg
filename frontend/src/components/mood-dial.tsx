"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Icon } from "@/components/icons";
import { MoodBlob, MoodHead, moodColor } from "@/components/mood-egg";
import { emotionTone, suggestEmotions } from "@/lib/emotions";
import { primeTick, select, success, tap, tickSteps } from "@/lib/haptics";
import { MOOD_LABEL } from "@/lib/mascots";

const STEPS = 41;     // 1.0 … 5.0 с шагом 0.1
const MAX_EMOTIONS = 4;
const TICK_WIDTH = 14;

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
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center"><MoodBlob value={value} size={64} still /></span>
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

// Окно отметки: персонаж, рулетка и подходящие эмоции на одном экране.
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
  const lastStep = useRef(Math.round(((mood ?? 3) - 1) * 10));
  const scrollFrame = useRef(0);
  const resetFrame = useRef(0);
  const level = Math.round(value);

  useEffect(() => {
    if (!open) return;
    const initial = mood ?? 3;
    const initialStep = Math.round((initial - 1) * 10);
    setValue(initial);
    setPicked(emotions ?? []);
    lastStep.current = initialStep;
    cancelAnimationFrame(scrollFrame.current);
    cancelAnimationFrame(resetFrame.current);
    resetFrame.current = requestAnimationFrame(() => {
      if (track.current) track.current.scrollLeft = initialStep * TICK_WIDTH;
    });
    return () => {
      cancelAnimationFrame(resetFrame.current);
      cancelAnimationFrame(scrollFrame.current);
    };
  }, [open, mood, emotions]);

  const applyStep = (step: number, tactile = true) => {
    const nextStep = Math.min(STEPS - 1, Math.max(0, Math.round(step)));
    const crossed = Math.abs(nextStep - lastStep.current);
    if (!crossed) return;
    lastStep.current = nextStep;
    setValue(1 + nextStep / 10);
    if (tactile) tickSteps(crossed);
  };

  const onScroll = () => {
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      if (track.current) applyStep(track.current.scrollLeft / TICK_WIDTH);
    });
  };

  const onMoodKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextStep = Math.min(STEPS - 1, Math.max(0, lastStep.current + (event.key === "ArrowRight" ? 1 : -1)));
    track.current?.scrollTo({ left: nextStep * TICK_WIDTH, behavior: "smooth" });
  };

  const toggle = (name: string) => {
    select();
    setPicked((cur) => cur.includes(name) ? cur.filter((item) => item !== name) : cur.length < MAX_EMOTIONS ? [...cur, name] : cur);
  };

  const close = () => {
    cancelAnimationFrame(resetFrame.current);
    cancelAnimationFrame(scrollFrame.current);
    onClose();
  };

  if (!open) return null;

  const suggestions = Array.from(new Set([...picked, ...suggestEmotions(level)]));
  const tint = moodColor(value);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-white text-[var(--ink)]">
      <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-[max(12px,env(safe-area-inset-top))]">
        <button onClick={() => { tap(); close(); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white stroke transition-transform active:scale-95" aria-label="Закрыть">
          <X size={19} weight="bold" />
        </button>
        <p className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.13em] stroke" style={{ background: `${tint}38` }}>Настроение сегодня</p>
        <span className="w-10" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
        <div className="relative h-[clamp(220px,31vh,270px)] w-full shrink-0 overflow-hidden">
          <MoodHead value={value} />
        </div>

        <div className="flex-1 px-4 pb-3 pt-2" style={{ backgroundColor: tint }}>
          <h2 className="text-center font-tight text-[clamp(27px,7.8vw,36px)] font-black uppercase leading-[0.9] tracking-[-0.04em]">
            Как ваше настроение сегодня?
          </h2>
          <div className="mt-2 flex items-center justify-center gap-2" aria-live="polite">
            <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-[12px] font-black capitalize text-white">{MOOD_LABEL[level]}</span>
            <span className="text-[11px] font-black tabular-nums text-black/50">{value.toFixed(1)} / 5</span>
          </div>

          <div className="relative mt-3">
            <div
              ref={track}
              data-testid="mood-roulette"
              role="slider"
              tabIndex={0}
              aria-label="Настроение от тяжёлого до отличного"
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={Number(value.toFixed(1))}
              aria-valuetext={MOOD_LABEL[level]}
              onPointerDown={primeTick}
              onScroll={onScroll}
              onKeyDown={onMoodKey}
              className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain py-1 outline-none focus-visible:ring-2 focus-visible:ring-black/30"
            >
              <span className="shrink-0" style={{ width: `calc(50% - ${TICK_WIDTH / 2}px)` }} />
              {Array.from({ length: STEPS }).map((_, index) => {
                const major = index % 10 === 0;
                return (
                  <span key={index} className="flex h-11 shrink-0 snap-center items-center justify-center" style={{ width: TICK_WIDTH }}>
                    <i className="block rounded-full" style={{ width: major ? 3 : 2, height: major ? 30 : 14, background: major ? "var(--ink)" : "var(--muted-2)", opacity: major ? 0.9 : 0.42 }} />
                  </span>
                );
              })}
              <span className="shrink-0" style={{ width: `calc(50% - ${TICK_WIDTH / 2}px)` }} />
            </div>
            <span className="pointer-events-none absolute left-1/2 top-0 h-[52px] w-1 -translate-x-1/2 rounded-full" style={{ background: tint, boxShadow: "0 0 0 2px var(--ink)" }} />
            <div className="mt-1 flex justify-between px-1 text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted-2)]">
              <span>тяжело</span><span>отлично</span>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[.1em]">Что вы чувствуете?</p>
              <p className="text-[10px] font-semibold text-[var(--muted-2)]">до {MAX_EMOTIONS}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((name) => {
                const on = picked.includes(name);
                const tone = emotionTone(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggle(name)}
                    aria-pressed={on}
                    className="rounded-full px-3 py-1.5 text-[11.5px] font-black transition-transform active:scale-95"
                    style={{ background: on ? `var(--${tone})` : "#fff", border: `var(--bw) solid var(--${on ? `${tone}-edge` : "edge-neutral"})`, color: on ? "var(--ink)" : "var(--muted)" }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2" style={{ backgroundColor: tint, borderTop: "var(--bw) solid rgba(32,28,24,.32)" }}>
        <button
          onClick={() => { success(); onSave(level, picked); close(); }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] py-3.5 text-[14px] font-black text-white transition-transform active:scale-[0.98]"
        >
          <Icon name="check" width={17} weight="bold" color="#fff" /> Сохранить настроение
        </button>
      </div>
    </div>
  );
}
