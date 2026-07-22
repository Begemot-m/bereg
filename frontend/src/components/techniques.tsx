"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Pause, Play, SpeakerHigh, SpeakerSlash, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { asset } from "@/lib/asset";
import { select, success, tap } from "@/lib/haptics";

const HISTORY_KEY = "bereg-practice-history-v1";
const DRAFT_PREFIX = "bereg-practice-draft-v1:";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const TONE = {
  sky: { bg: "#b9dce8", soft: "#e1f0f4", edge: "#5f95ab" },
  purple: { bg: "var(--purple)", soft: "var(--purple-soft)", edge: "var(--purple-edge)" },
  green: { bg: "var(--green)", soft: "var(--green-soft)", edge: "var(--green-edge)" },
  coral: { bg: "var(--coral)", soft: "var(--coral-soft)", edge: "var(--coral-edge)" },
  amber: { bg: "var(--amber)", soft: "var(--amber-soft)", edge: "var(--amber-edge)" },
} as const;

type Tone = keyof typeof TONE;
export type TechKey = "breathing" | "thought";
type HistoryItem = { id: string; tech: TechKey; completedAt: string; before?: number; after?: number; score?: number; protocol?: string; duration?: number };

export const TECH_META: Record<TechKey, { title: string; short: string; tone: Tone; icon: IconName; based: string; image: string }> = {
  breathing: { title: "Спокойное дыхание", short: "Дыхание", tone: "sky", icon: "pulse", based: "медленный ритм дыхания", image: "/practices/breathing-practice.png" },
  thought: { title: "Дневник мыслей", short: "Дневник", tone: "purple", icon: "note", based: "когнитивная модель КПТ", image: "/practices/automatic-thoughts.png" },
};

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

function saveResult(tech: TechKey, data: Omit<HistoryItem, "id" | "tech" | "completedAt"> = {}) {
  const next: HistoryItem = { id: crypto.randomUUID?.() ?? `${Date.now()}`, tech, completedAt: new Date().toISOString(), ...data };
  localStorage.setItem(HISTORY_KEY, JSON.stringify([next, ...loadHistory()].slice(0, 80)));
  localStorage.removeItem(`${DRAFT_PREFIX}${tech}`);
  window.setTimeout(() => localStorage.removeItem(`${DRAFT_PREFIX}${tech}`), 400);
  return next;
}

function useDraft<T>(tech: TechKey, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${DRAFT_PREFIX}${tech}`);
      if (raw) setValue({ ...initial, ...JSON.parse(raw) });
    } catch { /* повреждённый черновик не должен ломать практику */ }
    hydrated.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tech]);
  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => localStorage.setItem(`${DRAFT_PREFIX}${tech}`, JSON.stringify(value)), 250);
    return () => window.clearTimeout(timer);
  }, [tech, value]);
  return [value, setValue] as const;
}

function Progress({ value, tone }: { value: number; tone: Tone }) {
  const c = TONE[tone];
  const reduce = useReducedMotion();
  return <div className="h-2.5 overflow-hidden rounded-full bg-[#fffdf7]" style={{ border: `var(--bw) solid ${c.edge}` }}><motion.div className="h-full" animate={{ width: `${clamp(value, 0, 100)}%` }} transition={{ duration: reduce ? 0 : .28, ease: [0.32, 0.72, 0, 1] }} style={{ background: c.bg }} /></div>;
}

function TechShell({ tech, progress, onClose, children }: { tech: TechKey; progress: number; onClose: () => void; children: ReactNode }) {
  const meta = TECH_META[tech];
  const c = TONE[meta.tone];
  const reduce = useReducedMotion();
  useEffect(() => { const old = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = old; }; }, []);
  return <motion.div className="fixed inset-0 z-[90] flex justify-center bg-[rgba(32,28,24,.38)] p-0 @md:items-center @md:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <motion.section className="flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[var(--surface)] @md:h-[min(844px,94dvh)] @md:rounded-[30px]" initial={reduce ? false : { y: 28, opacity: .7 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: 20, opacity: 0 }} transition={{ duration: .24, ease: [0.32, 0.72, 0, 1] }} style={{ border: `var(--bw-lg) solid ${c.edge}` }}>
      <header className="shrink-0 px-4 pb-5 pt-[max(14px,env(safe-area-inset-top))]" style={{ background: c.bg, borderBottom: `var(--bw-lg) solid ${c.edge}` }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#fffdf7]" style={{ border: `var(--bw) solid ${c.edge}` }}><Icon name={meta.icon} width={20} weight="bold" /></span>
            <div className="min-w-0"><p className="truncate font-tight text-[18px] font-black leading-tight">{meta.title}</p><p className="truncate text-[10px] font-black uppercase tracking-[.07em] text-[var(--muted)]">{meta.based}</p></div>
          </div>
          <button onClick={() => { tap(); onClose(); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fffdf7] transition-transform active:scale-95" style={{ border: `var(--bw) solid ${c.edge}` }} aria-label="Закрыть"><X size={18} weight="bold" /></button>
        </div>
        <div className="mt-4"><Progress value={progress} tone={meta.tone} /></div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">{children}</div>
    </motion.section>
  </motion.div>;
}

export function TechniqueRunner({ tech, onClose }: { tech: TechKey; onClose: () => void }) {
  const [progress, setProgress] = useState(0);
  return <AnimatePresence><TechShell tech={tech} progress={progress} onClose={onClose}>
    {tech === "breathing" && <Breathing onProgress={setProgress} />}
    {tech === "thought" && <ThoughtRecord onProgress={setProgress} />}
  </TechShell></AnimatePresence>;
}

function Intro({ tech, eyebrow, title, text, note, onStart, action = "Начать" }: { tech: TechKey; eyebrow: string; title: string; text: string; note: string; onStart: () => void; action?: string | null }) {
  const meta = TECH_META[tech]; const c = TONE[meta.tone];
  const reduce = useReducedMotion();
  return <div>
    <div className="flex min-h-[230px] items-center justify-center overflow-hidden rounded-[24px]" style={{ background: c.soft, border: `var(--bw-lg) solid ${c.edge}` }}><motion.img src={asset(meta.image)} alt="" className="h-[220px] w-[220px] object-contain" initial={reduce ? false : { scale: .94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: reduce ? 0 : .35 }} /></div>
    <p className="mt-5 text-[10px] font-black uppercase tracking-[.1em]" style={{ color: c.edge }}>{eyebrow}</p>
    <h2 className="mt-1 font-tight text-[25px] font-black leading-[1.05]">{title}</h2>
    <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[var(--muted)]">{text}</p>
    <div className="mt-4 flex gap-2 rounded-[16px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><Icon name="spark" width={17} weight="bold" /><p className="text-[11px] font-semibold leading-relaxed text-[var(--muted)]">{note}</p></div>
    {action !== null && <Primary onClick={onStart}>{action}</Primary>}
  </div>;
}

function Primary({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button onClick={() => { tap(); onClick(); }} disabled={disabled} className="mt-5 w-full rounded-[16px] bg-[var(--ink)] py-3.5 text-[14px] font-black text-white transition-transform duration-150 active:scale-[.98] disabled:opacity-40">{children}</button>;
}

function Back({ onClick }: { onClick: () => void }) {
  return <button onClick={() => { tap(); onClick(); }} className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-[15px] bg-white py-3 text-[13px] font-black" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><ArrowLeft size={16} weight="bold" /> Назад</button>;
}

function Rating({ value, onChange, tone, label }: { value: number; onChange: (v: number) => void; tone: Tone; label: string }) {
  const c = TONE[tone];
  return <div><div className="mb-2 flex items-end justify-between"><p className="text-[12px] font-black">{label}</p><span className="tnum rounded-full px-2.5 py-1 text-[13px] font-black" style={{ background: c.soft, border: `var(--bw) solid ${c.edge}` }}>{value}/10</span></div><div className="grid grid-cols-11 gap-1">{Array.from({ length: 11 }, (_, i) => <button key={i} onClick={() => { select(); onChange(i); }} className="h-9 rounded-[9px] text-[10px] font-black transition-transform active:scale-90" style={i <= value ? { background: c.bg, border: `var(--bw) solid ${c.edge}` } : { background: "#fff", border: "var(--bw) solid var(--edge-neutral)", color: "var(--muted-2)" }} aria-label={`${i} из 10`}>{i}</button>)}</div></div>;
}

/* Дыхание: медленный ритм 4/6 по умолчанию; 4-7-8 остаётся дополнительным протоколом. */
type BreathStage = "intro" | "setup" | "rating" | "run" | "after" | "done";
function playBreathCue(ctx: AudioContext | null, frequency = 560) {
  if (!ctx || ctx.state === "closed") return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.2);
}
function Breathing({ onProgress }: { onProgress: (n: number) => void }) {
  const [stage, setStage] = useState<BreathStage>("intro");
  const [protocol, setProtocol] = useState<"slow" | "478">("slow");
  const [minutes, setMinutes] = useState(1);
  const [before, setBefore] = useState(6);
  const [after, setAfter] = useState(4);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(false);
  const reduce = useReducedMotion();
  const audioRef = useRef<AudioContext | null>(null);
  const phases = useMemo(() => protocol === "slow" ? [{ name: "Вдох", seconds: 4 }, { name: "Выдох", seconds: 6 }] : [{ name: "Вдох", seconds: 4 }, { name: "Пауза", seconds: 7 }, { name: "Выдох", seconds: 8 }], [protocol]);
  const [phase, setPhase] = useState(0);
  const [phaseLeft, setPhaseLeft] = useState(4);
  const [totalLeft, setTotalLeft] = useState(60);
  const c = TONE.sky;

  useEffect(() => () => { void audioRef.current?.close(); }, []);
  useEffect(() => {
    const map: Record<BreathStage, number> = { intro: 0, setup: 12, rating: 24, run: 30 + ((minutes * 60 - totalLeft) / (minutes * 60)) * 50, after: 88, done: 100 };
    onProgress(map[stage]);
  }, [stage, totalLeft, minutes, onProgress]);
  useEffect(() => {
    if (stage !== "run" || !running) return;
    const iv = window.setInterval(() => {
      if (document.hidden) return;
      setTotalLeft((v) => { if (v <= 1) { window.clearInterval(iv); setRunning(false); setStage("after"); success(); return 0; } return v - 1; });
      setPhaseLeft((v) => { if (v <= 1) { const next = (phase + 1) % phases.length; setPhase(next); select(); if (sound) playBreathCue(audioRef.current, phases[next].name === "Выдох" ? 460 : 620); return phases[next].seconds; } return v - 1; });
    }, 1000);
    return () => window.clearInterval(iv);
  }, [stage, running, phase, phases, sound]);

  if (stage === "intro") return <Intro tech="breathing" eyebrow="1–5 минут" title="Дайте телу более спокойный ритм" text="Мягкий вдох на 4 счёта и более длинный выдох на 6. Не нужно стараться дышать глубже обычного." note="Медленное дыхание может снизить напряжение в моменте, но это не лечение и не тест на «правильность»." onStart={() => setStage("setup")} />;
  if (stage === "setup") return <div><h2 className="font-tight text-[23px] font-black">Настройте практику</h2><p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Начните с минуты. Остановиться можно в любой момент.</p>
    <p className="lbl mt-5">Ритм</p><div className="grid grid-cols-2 gap-2">{([{ id: "slow", title: "4 · 6", text: "вдох · выдох" }, { id: "478", title: "4 · 7 · 8", text: "с паузой" }] as const).map((x) => <button key={x.id} onClick={() => { select(); setProtocol(x.id); }} className="rounded-[18px] p-3 text-left" style={protocol === x.id ? { background: c.soft, border: `var(--bw-lg) solid ${c.edge}` } : { background: "#fff", border: "var(--bw) solid var(--edge-neutral)" }}><span className="block font-tight text-[20px] font-black">{x.title}</span><span className="text-[11px] font-semibold text-[var(--muted)]">{x.text}</span></button>)}</div>
    {protocol === "478" && <p className="mt-2 rounded-[14px] bg-[var(--amber-soft)] p-3 text-[11px] font-semibold text-[var(--muted)]" style={{ border: "var(--bw) solid var(--amber-edge)" }}>Пауза подходит не всем. Если появляется дискомфорт или головокружение, вернитесь к ритму 4 · 6.</p>}
    <p className="lbl mt-5">Длительность</p><div className="grid grid-cols-3 gap-2">{[1, 3, 5].map((m) => <button key={m} onClick={() => { select(); setMinutes(m); }} className="rounded-[14px] py-3 text-[13px] font-black" style={minutes === m ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", border: "var(--bw) solid var(--edge-neutral)" }}>{m} мин</button>)}</div>
    <Primary onClick={() => setStage("rating")}>Дальше</Primary><Back onClick={() => setStage("intro")} /></div>;
  if (stage === "rating") return <div><h2 className="font-tight text-[23px] font-black">Как вы сейчас?</h2><p className="mb-6 mt-1 text-[12px] font-semibold text-[var(--muted)]">Отметка нужна только для вашей личной динамики.</p><Rating value={before} onChange={setBefore} tone="sky" label="Напряжение до практики" /><Primary onClick={() => { setTotalLeft(minutes * 60); setPhase(0); setPhaseLeft(phases[0].seconds); setRunning(true); setStage("run"); }}>Начать дыхание</Primary><Back onClick={() => setStage("setup")} /></div>;
  if (stage === "run") { const current = phases[phase]; const pct = 1 - phaseLeft / current.seconds; return <div className="flex min-h-full flex-col items-center"><div className="flex w-full items-center justify-between"><span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black" style={{ border: `var(--bw) solid ${c.edge}` }}>{Math.floor(totalLeft / 60)}:{String(totalLeft % 60).padStart(2, "0")}</span><button onClick={() => { tap(); if (!sound) { const ctx = audioRef.current ?? new window.AudioContext(); audioRef.current = ctx; void ctx.resume().then(() => playBreathCue(ctx)); setSound(true); } else { setSound(false); } }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ border: `var(--bw) solid ${c.edge}` }} aria-label={sound ? "Выключить сигнал" : "Включить сигнал"}>{sound ? <SpeakerHigh size={17} weight="bold" /> : <SpeakerSlash size={17} weight="bold" />}</button></div>
    <div className="relative my-5 flex h-[300px] w-full items-center justify-center overflow-hidden rounded-[26px]" style={{ background: c.soft, border: `var(--bw-lg) solid ${c.edge}` }}>
      {/* Расширяющийся пунктирный круг: вдох — растёт, выдох — сжимается */}
      {(() => { const scale = reduce ? 1 : current.name === "Вдох" ? 0.62 + pct * 0.5 : current.name === "Выдох" ? 1.12 - pct * 0.5 : 1.12;
        return <>
          <motion.div aria-hidden className="absolute rounded-full" style={{ width: 210, height: 210, background: "#fffdf7" }} animate={{ scale: scale * 0.82 }} transition={{ duration: reduce ? 0 : 0.9, ease: "linear" }} />
          <motion.div aria-hidden className="absolute rounded-full" style={{ width: 210, height: 210, border: `3px dashed ${c.edge}` }} animate={{ scale, rotate: 360 }} transition={{ scale: { duration: reduce ? 0 : 0.9, ease: "linear" }, rotate: { duration: current.seconds, ease: "linear", repeat: Infinity } }} />
          <motion.div aria-hidden className="absolute rounded-full" style={{ width: 210, height: 210, border: `2px dashed ${c.edge}`, opacity: 0.45 }} animate={{ scale: scale * 1.16, rotate: -360 }} transition={{ scale: { duration: reduce ? 0 : 0.9, ease: "linear" }, rotate: { duration: current.seconds * 1.6, ease: "linear", repeat: Infinity } }} />
        </>; })()}
      <div className="relative z-[1] text-center"><p className="font-tight text-[24px] font-black leading-none">{current.name}</p><p className="tnum mt-1.5 text-[40px] font-black leading-none">{phaseLeft}</p></div>
    </div>
    <p className="text-center text-[11px] font-semibold text-[var(--muted)]">Дышите комфортно. Не нужно наполнять лёгкие до предела.</p><button onClick={() => { tap(); setRunning(!running); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--ink)] py-3.5 text-[14px] font-black text-white">{running ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}{running ? "Пауза" : "Продолжить"}</button><button onClick={() => { setRunning(false); setStage("after"); }} className="mt-2 py-2 text-[11px] font-black text-[var(--muted)]">Завершить раньше</button></div>; }
  if (stage === "after") return <div><h2 className="font-tight text-[23px] font-black">Что изменилось?</h2><p className="mb-6 mt-1 text-[12px] font-semibold text-[var(--muted)]">Любой результат нормален — даже если напряжение осталось тем же.</p><Rating value={after} onChange={setAfter} tone="green" label="Напряжение после практики" /><Primary onClick={() => { saveResult("breathing", { before, after, protocol, duration: minutes * 60 - totalLeft }); setStage("done"); success(); }}>Сохранить наблюдение</Primary></div>;
  return <ResultCard tech="breathing" title="Практика завершена" text={after < before ? `Напряжение изменилось с ${before} до ${after}. Это личное наблюдение, не оценка.` : "Вы остановились и уделили внимание состоянию — этого уже достаточно."} onAgain={() => setStage("setup")} />;
}

type ThoughtData = { mode: "quick" | "full"; step: number; situation: string; thought: string; emotion: string; before: number; evidenceFor: string; evidenceAgainst: string; distortions: string[]; alternative: string; action: string; after: number; done: boolean };
const THOUGHT_INIT: ThoughtData = { mode: "quick", step: -1, situation: "", thought: "", emotion: "тревога", before: 6, evidenceFor: "", evidenceAgainst: "", distortions: [], alternative: "", action: "", after: 4, done: false };
const EMOTIONS = ["тревога", "грусть", "злость", "стыд", "вина", "бессилие"];
const DISTORTIONS = [{ n: "Катастрофизация", d: "ожидание худшего" }, { n: "Чтение мыслей", d: "догадки за других" }, { n: "Всё или ничего", d: "только две крайности" }, { n: "Обесценивание", d: "хорошее не считается" }, { n: "Долженствование", d: "жёсткие «должен»" }, { n: "Ярлык", d: "оценка себя целиком" }];

// Журнал записей дневника мыслей: сохраняется на устройстве.
const JOURNAL_KEY = "bereg-thought-journal-v1";
type JournalEntry = { id: string; date: string; situation: string; thought: string; emotion: string; before: number; after: number; alternative: string; distortions: string[] };
function loadJournal(): JournalEntry[] { try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || "[]"); } catch { return []; } }
function saveJournal(list: JournalEntry[]) { try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(list.slice(0, 60))); } catch { /* ignore */ } }
const journalDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function ThoughtRecord({ onProgress }: { onProgress: (n: number) => void }) {
  const [d, setD] = useDraft<ThoughtData>("thought", THOUGHT_INIT);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [view, setView] = useState<JournalEntry | null>(null);
  useEffect(() => setJournal(loadJournal()), [d.done]);
  const upd = (p: Partial<ThoughtData>) => setD((v) => ({ ...v, ...p }));
  const steps = d.mode === "quick" ? ["situation", "thought", "emotion", "alternative"] : ["situation", "thought", "emotion", "evidence", "distortions", "alternative", "action"];
  useEffect(() => onProgress(d.done ? 100 : d.step < 0 ? 0 : 12 + ((d.step + 1) / steps.length) * 76), [d.done, d.step, steps.length, onProgress]);

  if (view) return <ThoughtEntryView entry={view} onBack={() => setView(null)} onDelete={() => { const list = journal.filter((x) => x.id !== view.id); saveJournal(list); setJournal(list); setView(null); tap(); }} />;
  if (d.done) return <ResultCard tech="thought" title="Запись сохранена в дневник" text={`Интенсивность эмоции: ${d.before} → ${d.after}. Запись теперь в истории — можно вернуться к ней на сессии.`} onAgain={() => setD({ ...THOUGHT_INIT, mode: d.mode, step: 0 })} />;
  if (d.step < 0) return <div>
    <Intro tech="thought" eyebrow="2–7 минут" title="Дневник мыслей" text="Разложите тревожную мысль по частям и посмотрите на неё спокойнее. Все записи остаются в истории ниже." note="Запись мыслей — упражнение из КПТ. Она помогает увидеть связь между ситуацией, мыслью, эмоцией и действием." onStart={() => upd({ step: 0 })} action={null} />
    <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => upd({ mode: "quick", step: 0 })} className="rounded-[16px] bg-[var(--purple-soft)] p-3 text-left" style={{ border: "var(--bw) solid var(--purple-edge)" }}><b className="block text-[13px]">Новая запись · быстро</b><span className="text-[10px] font-semibold text-[var(--muted)]">4 коротких шага</span></button><button onClick={() => upd({ mode: "full", step: 0 })} className="rounded-[16px] bg-white p-3 text-left" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><b className="block text-[13px]">Новая запись · подробно</b><span className="text-[10px] font-semibold text-[var(--muted)]">полная КПТ-запись</span></button></div>
    <ThoughtJournalList journal={journal} onOpen={setView} />
  </div>;
  const key = steps[d.step];
  const next = () => {
    if (d.step === steps.length - 1) {
      saveResult("thought", { before: d.before, after: d.after });
      const entry: JournalEntry = { id: `${Date.now()}`, date: new Date().toISOString(), situation: d.situation, thought: d.thought, emotion: d.emotion, before: d.before, after: d.after, alternative: d.alternative, distortions: d.distortions };
      saveJournal([entry, ...loadJournal()]);
      upd({ done: true }); success();
    } else upd({ step: d.step + 1 });
  };
  return <div><div className="mb-5 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted)]">{d.mode === "quick" ? "Короткая запись" : "Подробная запись"}</span><span className="text-[11px] font-black">{d.step + 1}/{steps.length}</span></div>
    {key === "situation" && <StepText title="Что произошло?" hint="Только факты: где, когда, с кем." value={d.situation} onChange={(s) => upd({ situation: s })} placeholder="Например: весь день не ответили на сообщение" />}
    {key === "thought" && <StepText title="Какая мысль мелькнула?" hint="Запишите её так, как она прозвучала в голове." value={d.thought} onChange={(s) => upd({ thought: s })} placeholder="Наверное, я ему безразличен" />}
    {key === "emotion" && <div><h2 className="font-tight text-[23px] font-black">Что вы почувствовали?</h2><p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Выберите ближайшее слово.</p><div className="mt-4 flex flex-wrap gap-2">{EMOTIONS.map((x) => <button key={x} onClick={() => { select(); upd({ emotion: x }); }} className="rounded-full px-3 py-2 text-[12px] font-black" style={d.emotion === x ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", border: "var(--bw) solid var(--edge-neutral)" }}>{x}</button>)}</div><div className="mt-6"><Rating value={d.before} onChange={(v) => upd({ before: v })} tone="coral" label="Интенсивность эмоции" /></div></div>}
    {key === "evidence" && <div><h2 className="font-tight text-[23px] font-black">Проверьте мысль</h2><p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Не спорьте с собой — соберите наблюдаемые факты.</p><label className="mt-5 block"><span className="lbl">Что говорит в пользу мысли?</span><textarea className="tf" rows={3} value={d.evidenceFor} onChange={(e) => upd({ evidenceFor: e.target.value })} placeholder="Факты, а не ощущения" /></label><label className="mt-4 block"><span className="lbl">Что с ней не согласуется?</span><textarea className="tf" rows={3} value={d.evidenceAgainst} onChange={(e) => upd({ evidenceAgainst: e.target.value })} placeholder="Исключения, альтернативные объяснения" /></label></div>}
    {key === "distortions" && <div><h2 className="font-tight text-[23px] font-black">Есть знакомый шаблон?</h2><p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Это не ошибка характера, а привычный способ думать.</p><div className="mt-4 space-y-2">{DISTORTIONS.map((x) => { const on = d.distortions.includes(x.n); return <button key={x.n} onClick={() => upd({ distortions: on ? d.distortions.filter((y) => y !== x.n) : [...d.distortions, x.n] })} className="flex w-full items-center gap-3 rounded-[16px] p-3 text-left" style={on ? { background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" } : { background: "#fff", border: "var(--bw) solid var(--edge-neutral)" }}><Icon name={on ? "check" : "note"} width={18} weight="bold" /><span><b className="block text-[12px]">{x.n}</b><span className="text-[10px] font-semibold text-[var(--muted)]">{x.d}</span></span></button>; })}</div></div>}
    {key === "alternative" && <div><StepText title="Более взвешенный взгляд" hint="Что бы вы сказали близкому человеку? Учтите и трудное, и поддерживающее." value={d.alternative} onChange={(s) => upd({ alternative: s })} placeholder="Мне неприятна неопределённость, но у молчания могут быть разные причины" /><div className="mt-5"><Rating value={d.after} onChange={(v) => upd({ after: v })} tone="green" label="Интенсивность эмоции теперь" /></div></div>}
    {key === "action" && <StepText title="Один маленький шаг" hint="Что можно сделать бережно и конкретно в ближайшие сутки?" value={d.action} onChange={(s) => upd({ action: s })} placeholder="Отложить телефон на 20 минут и вернуться к своим делам" />}
    <Primary onClick={next}>{d.step === steps.length - 1 ? "Сохранить запись" : "Продолжить"}</Primary>{d.step > 0 && <Back onClick={() => upd({ step: d.step - 1 })} />}<p className="mt-3 text-center text-[10px] font-semibold text-[var(--muted-2)]">Черновик сохраняется на этом устройстве автоматически.</p>
  </div>;
}

function StepText({ title, hint, value, onChange, placeholder }: { title: string; hint: string; value: string; onChange: (s: string) => void; placeholder: string }) {
  return <div><h2 className="font-tight text-[23px] font-black">{title}</h2><p className="mt-1 text-[12px] font-semibold leading-relaxed text-[var(--muted)]">{hint}</p><textarea autoFocus className="tf mt-5 min-h-[130px]" rows={5} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></div>;
}

// История дневника: карточки записей с датой, мыслью и динамикой эмоции.
function ThoughtJournalList({ journal, onOpen }: { journal: JournalEntry[]; onOpen: (e: JournalEntry) => void }) {
  if (!journal.length) return <div className="mt-6 rounded-[16px] bg-white p-4 text-center" style={{ border: "var(--bw) dashed var(--purple-edge)" }}><Icon name="book" width={22} weight="bold" /><p className="mt-1.5 text-[12px] font-black">История записей пуста</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">Первая запись появится здесь после сохранения.</p></div>;
  return <div className="mt-6">
    <div className="mb-2 flex items-center justify-between px-1"><span className="text-[11px] font-black uppercase tracking-[.08em] text-[var(--muted)]">История</span><span className="text-[11px] font-black text-[var(--muted-2)]">{journal.length}</span></div>
    <div className="space-y-2">
      {journal.map((e) => {
        const better = e.after < e.before;
        return <button key={e.id} onClick={() => { tap(); onOpen(e); }} className="flex w-full items-center gap-3 rounded-[16px] bg-white p-3 text-left transition-transform active:scale-[.99]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5"><span className="rounded-full bg-[var(--purple-soft)] px-2 py-0.5 text-[9px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>{e.emotion}</span><span className="text-[10px] font-bold text-[var(--muted-2)]">{journalDate.format(new Date(e.date))}</span></span>
            <span className="mt-1 block truncate text-[13px] font-black">{e.thought || e.situation || "Без текста"}</span>
          </span>
          <span className="tnum shrink-0 rounded-full px-2 py-1 text-[11px] font-black" style={{ background: better ? "var(--green-soft)" : "var(--surface-2)", border: `var(--bw) solid ${better ? "var(--green-edge)" : "var(--edge-neutral)"}` }}>{e.before}→{e.after}</span>
        </button>;
      })}
    </div>
  </div>;
}

function ThoughtEntryView({ entry, onBack, onDelete }: { entry: JournalEntry; onBack: () => void; onDelete: () => void }) {
  const row = (label: string, value: string) => value ? <div><p className="lbl">{label}</p><p className="mt-0.5 text-[13px] font-semibold leading-relaxed">{value}</p></div> : null;
  return <div>
    <div className="mb-4 flex items-center justify-between"><button onClick={onBack} className="flex items-center gap-1 text-[12px] font-black text-[var(--muted)]"><ArrowLeft size={15} weight="bold" /> К истории</button><span className="text-[11px] font-bold text-[var(--muted-2)]">{journalDate.format(new Date(entry.date))}</span></div>
    <div className="flex items-center gap-2"><span className="rounded-full bg-[var(--purple-soft)] px-3 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>{entry.emotion}</span><span className="tnum rounded-full bg-white px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>интенсивность {entry.before} → {entry.after}</span></div>
    <div className="mt-4 space-y-4 rounded-[18px] bg-white p-4" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      {row("Ситуация", entry.situation)}
      {row("Автоматическая мысль", entry.thought)}
      {entry.distortions.length > 0 && <div><p className="lbl">Шаблоны мышления</p><div className="mt-1 flex flex-wrap gap-1.5">{entry.distortions.map((x) => <span key={x} className="rounded-full bg-[var(--purple-soft)] px-2 py-0.5 text-[10px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>{x}</span>)}</div></div>}
      {row("Более взвешенный взгляд", entry.alternative)}
    </div>
    <button onClick={onDelete} className="mt-4 w-full py-2.5 text-center text-[12px] font-black text-[var(--muted)] hover:text-[var(--warn)]">Удалить запись</button>
  </div>;
}

function ResultCard({ tech, title, text, onAgain }: { tech: TechKey; title: string; text: string; onAgain: () => void }) {
  const meta = TECH_META[tech]; const c = TONE[meta.tone];
  return <div className="text-center"><div className="mx-auto flex h-[188px] w-full items-center justify-center rounded-[24px]" style={{ background: c.soft, border: `var(--bw-lg) solid ${c.edge}` }}><img src={asset(meta.image)} alt="" className="h-[172px] w-[172px] object-contain" /></div><span className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ background: c.bg, border: `var(--bw) solid ${c.edge}` }}><Icon name="check" width={21} weight="fill" /></span><h2 className="mt-3 font-tight text-[23px] font-black">{title}</h2><p className="mx-auto mt-2 max-w-[310px] text-[12px] font-semibold leading-relaxed text-[var(--muted)]">{text}</p><Primary onClick={onAgain}>Повторить практику</Primary><p className="mt-3 text-[10px] font-semibold text-[var(--muted-2)]">Результат сохранён только на этом устройстве.</p></div>;
}
