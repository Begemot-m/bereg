"use client";

import { ArrowLeft, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Icon } from "@/components/icons";
import { MoodBlob, MoodHead, moodColor } from "@/components/mood-egg";
import { suggestFamilies } from "@/lib/emotions";
import { primeTick, select, success, tap, tickSteps } from "@/lib/haptics";
import { MOOD_LABEL } from "@/lib/mascots";

const STEPS = 41;     // 1.0 … 5.0 с шагом 0.1
const MAX_EMOTIONS = 4;
const PX_PER_STEP = 8;
const QUICK_LEVELS = [1, 2, 3, 4, 5] as const;

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

// Окно отметки: иммерсивный свайп по персонажу, затем уточнение эмоций.
export function MoodSheet({ open, mood, emotions, onClose, onSave }: {
  open: boolean;
  mood?: number;
  emotions?: string[];
  onClose: () => void;
  onSave: (mood: number, emotions: string[]) => void;
}) {
  const [value, setValue] = useState(mood ?? 3);
  const [picked, setPicked] = useState<string[]>(emotions ?? []);
  const [screen, setScreen] = useState<"mood" | "details">("mood");
  const drag = useRef<{ x: number; step: number } | null>(null);
  const lastStep = useRef(Math.round(((mood ?? 3) - 1) * 10));
  const moodScroll = useRef<HTMLElement>(null);
  const resetFrame = useRef(0);
  const dragFrame = useRef(0);
  const pendingStep = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const level = Math.round(value);

  useEffect(() => {
    if (!open) return;
    setValue(mood ?? 3);
    setPicked(emotions ?? []);
    setScreen("mood");
    lastStep.current = Math.round(((mood ?? 3) - 1) * 10);
    drag.current = null;
    pendingStep.current = null;
    cancelAnimationFrame(dragFrame.current);
    cancelAnimationFrame(resetFrame.current);
    resetFrame.current = requestAnimationFrame(() => moodScroll.current?.scrollTo({ top: 0 }));
    return () => {
      cancelAnimationFrame(resetFrame.current);
      cancelAnimationFrame(dragFrame.current);
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

  const chooseLevel = (nextLevel: number) => {
    select();
    const nextStep = (nextLevel - 1) * 10;
    lastStep.current = nextStep;
    setValue(nextLevel);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    primeTick();
    drag.current = { x: event.clientX, step: lastStep.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    pendingStep.current = drag.current.step + (event.clientX - drag.current.x) / PX_PER_STEP;
    if (dragFrame.current) return;
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = 0;
      if (pendingStep.current !== null) applyStep(pendingStep.current);
    });
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (pendingStep.current !== null) applyStep(pendingStep.current);
    pendingStep.current = null;
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = 0;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onMoodKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    applyStep(lastStep.current + (event.key === "ArrowRight" ? 1 : -1));
  };

  const toggle = (name: string) => {
    select();
    setPicked((cur) => cur.includes(name) ? cur.filter((item) => item !== name) : cur.length < MAX_EMOTIONS ? [...cur, name] : cur);
  };

  const close = () => { drag.current = null; cancelAnimationFrame(resetFrame.current); onClose(); };

  if (!open) return null;

  const families = suggestFamilies(level);
  const tint = moodColor(value);
  const transition = reducedMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 28 };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-white">
      <AnimatePresence initial={false} mode="wait">
        {screen === "mood" ? (
          <motion.section
            ref={moodScroll}
            key="mood"
            className="flex h-full min-h-0 flex-col overflow-y-auto bg-white text-[var(--ink)]"
            initial={{ x: reducedMotion ? 0 : -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reducedMotion ? 0 : -24, opacity: 0 }}
            transition={transition}
          >
            <div className="flex items-center justify-between px-4 pb-1 pt-[max(12px,env(safe-area-inset-top))]">
              <button onClick={() => { tap(); close(); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 stroke transition-transform active:scale-95" aria-label="Закрыть">
                <X size={19} weight="bold" />
              </button>
              <p className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.13em] stroke" style={{ background: `${tint}38` }}>Настроение сегодня</p>
              <span className="w-10" />
            </div>

            <div
              data-testid="mood-swipe-area"
              role="slider"
              tabIndex={0}
              aria-label="Настроение от тяжёлого до отличного"
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={Number(value.toFixed(1))}
              aria-valuetext={MOOD_LABEL[level]}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onKeyDown={onMoodKey}
              className="relative mt-1 h-[clamp(260px,38vh,320px)] shrink-0 cursor-grab touch-none select-none overflow-hidden outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/40"
            >
              <div className="absolute inset-0">
                <MoodHead value={value} />
              </div>
            </div>

            <div className="relative z-20 px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
              <motion.h2 layout className="text-center font-tight text-[clamp(29px,8.5vw,40px)] font-black uppercase leading-[0.88] tracking-[-0.045em]">
                Как ваше<br />настроение сегодня?
              </motion.h2>
              <div className="mt-3 flex items-center justify-center gap-2" aria-live="polite">
                <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-[13px] font-black capitalize text-white">{MOOD_LABEL[level]}</span>
                <span className="text-[11px] font-black tabular-nums text-black/55">{value.toFixed(1)} / 5</span>
              </div>

              <div className="mx-auto mt-3 flex max-w-[280px] items-center justify-between" aria-hidden="true">
                {QUICK_LEVELS.map((item) => (
                  <motion.span
                    key={item}
                    className="block rounded-full bg-[var(--ink)]"
                    animate={{ width: level === item ? 28 : 7, height: 7, opacity: level === item ? 1 : 0.32 }}
                    transition={transition}
                  />
                ))}
              </div>
              <p className="mt-2 text-center text-[10px] font-bold text-black/50">Проведите по персонажу · каждое деление ощущается</p>

              <div className="mt-4 grid grid-cols-5 gap-1.5">
                {QUICK_LEVELS.map((item) => {
                  const active = level === item;
                  return (
                    <button
                      key={item}
                      onClick={() => chooseLevel(item)}
                      aria-pressed={active}
                      className="min-w-0 rounded-full px-1 py-2 text-[9.5px] font-black capitalize transition-transform active:scale-95"
                      style={{ background: active ? "var(--ink)" : "rgba(255,255,255,.72)", color: active ? "#fff" : "var(--ink)", border: "var(--bw) solid rgba(32,28,24,.58)" }}
                    >
                      {MOOD_LABEL[item]}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => { tap(); setScreen("details"); }}
                className="mt-4 flex w-full items-center justify-center rounded-full bg-[var(--ink)] py-3.5 text-[14px] font-black text-white transition-transform active:scale-[0.98]"
              >
                Дальше
              </button>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="details"
            className="flex h-full min-h-0 flex-col bg-[var(--surface)]"
            initial={{ x: reducedMotion ? 0 : 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reducedMotion ? 0 : 28, opacity: 0 }}
            transition={transition}
          >
            <div className="flex items-center justify-between bg-white px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
              <button onClick={() => { tap(); setScreen("mood"); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 stroke transition-transform active:scale-95" aria-label="Назад к настроению">
                <ArrowLeft size={19} weight="bold" />
              </button>
              <p className="text-[10px] font-black uppercase tracking-[.13em]">Уточните состояние</p>
              <span className="w-10" />
            </div>

            <div className="relative h-[154px] shrink-0 overflow-hidden bg-white">
              <div className="absolute -bottom-16 left-1/2 h-[220px] w-[270px] -translate-x-1/2"><MoodHead value={value} /></div>
              <div className="absolute inset-x-0 bottom-3 text-center">
                <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-[12px] font-black capitalize text-white">{MOOD_LABEL[level]}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-t-[28px] bg-[var(--surface)] px-4 pb-32 pt-5" style={{ borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
              <h2 className="font-tight text-[27px] font-black leading-[.96] tracking-tight">Что именно<br />вы чувствуете?</h2>
              <p className="mt-2 text-[11px] font-semibold text-[var(--muted)]">Можно выбрать до {MAX_EMOTIONS} состояний. Мы покажем их в динамике настроения.</p>

              <div className="mt-5 space-y-4">
                {families.map((family) => (
                  <div key={family.key}>
                    <p className="mb-2 text-[9px] font-black uppercase tracking-[.11em] text-[var(--muted-2)]">{family.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {family.items.map((name) => {
                        const on = picked.includes(name);
                        return (
                          <button
                            key={name}
                            onClick={() => toggle(name)}
                            aria-pressed={on}
                            className="rounded-full px-3.5 py-2 text-[12px] font-black transition-transform active:scale-95"
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
            </div>

            <div className="absolute inset-x-0 bottom-0 bg-[var(--surface)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3" style={{ borderTop: "var(--bw) solid var(--edge-neutral)" }}>
              <button
                onClick={() => { success(); onSave(level, picked); close(); }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] py-3.5 text-[14px] font-black text-white transition-transform active:scale-[0.98]"
              >
                <Icon name="check" width={17} weight="bold" color="#fff" /> Сохранить настроение
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
