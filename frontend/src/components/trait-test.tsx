"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { ArrowGlyph } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { Disclosure } from "@/components/ui";
import { select, success, tap } from "@/lib/haptics";
import type { PdfBlock } from "@/lib/trait-report-pdf";
import {
  ANSWERS,
  DISCLAIMER,
  SCALES,
  VARIANTS,
  buildReport,
  pickQuestions,
  resultsFromPercents,
  scoreAnswers,
  type Question,
  type ScaleResult,
  type State,
  type Variant,
} from "@/lib/trait-test";

const TONE = {
  bg: "var(--purple)",
  soft: "var(--purple-soft)",
  edge: "var(--purple-edge)",
  // Шапка — светлее чистой лаванды, чтобы не давить на контент.
  head: "color-mix(in srgb, var(--purple) 52%, #fff)",
};
// Пустое пространство дорожек — тёплый бежевый, а не персик раздела.
const TRACK = "#f3ece1";
const DRAFT_KEY = "bereg-trait-test-draft-v1";
const RESULT_KEY = "bereg-trait-test-v1";

type Draft = { variant: Variant; seed: string; answers: Record<string, number>; index: number };
type Saved = { completedAt: string; variant: Variant; percents: Record<string, number> };
type Stage = "intro" | "instruction" | "test" | "result";

// bar — лёгкий пастельный тон дорожки, edge — только для мелкого текста.
const STATE_TONE: Record<State, { label: string; bg: string; edge: string; bar: string }> = {
  low: { label: "слабо", bg: "var(--green-soft)", edge: "var(--green-edge)", bar: "var(--green)" },
  mid: { label: "умеренно", bg: "var(--amber-soft)", edge: "var(--amber-edge)", bar: "var(--amber)" },
  high: { label: "выражено", bg: "var(--salmon-soft)", edge: "var(--salmon-edge)", bar: "var(--salmon)" },
};

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && d.seed && d.answers ? d : null;
  } catch { return null; }
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    return s && s.percents ? s : null;
  } catch { return null; }
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function TraitTest({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [variant, setVariant] = useState<Variant>(120);
  const [seed, setSeed] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ScaleResult[] | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    setSaved(loadSaved());
    setDraft(loadDraft());
  }, []);

  const questions = useMemo<Question[]>(() => (seed ? pickQuestions(variant, seed) : []), [variant, seed]);
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  const progress = stage === "result" ? 100 : questions.length ? Math.round((answered / questions.length) * 100) : 0;

  // Черновик: длинный тест не должен пропадать, если закрыли экран.
  useEffect(() => {
    if (stage !== "test" || !seed) return;
    const t = window.setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ variant, seed, answers, index } satisfies Draft));
    }, 200);
    return () => window.clearTimeout(t);
  }, [stage, variant, seed, answers, index]);

  const start = (v: Variant) => {
    setVariant(v);
    setSeed(crypto.randomUUID?.() ?? String(Date.now()));
    setAnswers({});
    setIndex(0);
    setStage("instruction");
  };

  const resume = () => {
    if (!draft) return;
    setVariant(draft.variant);
    setSeed(draft.seed);
    setAnswers(draft.answers);
    setIndex(Math.min(draft.index, draft.variant - 1));
    setStage("test");
  };

  const finish = (final: Record<string, number>) => {
    const rows = scoreAnswers(questions, final);
    const percents: Record<string, number> = {};
    for (const r of rows) percents[r.code] = r.percent;
    const record: Saved = { completedAt: new Date().toISOString(), variant, percents };
    localStorage.setItem(RESULT_KEY, JSON.stringify(record));
    localStorage.removeItem(DRAFT_KEY);
    setSaved(record);
    setDraft(null);
    setResults(rows);
    setStage("result");
    success();
  };

  const answer = (value: number) => {
    const q = questions[index];
    if (!q) return;
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    select();
    if (index + 1 >= questions.length) finish(next);
    else setIndex(index + 1);
  };

  const openSaved = () => {
    if (!saved) return;
    setVariant(saved.variant);
    setResults(resultsFromPercents(saved.percents));
    setStage("result");
  };

  const toIntro = () => {
    // Уходим из теста — черновик уже в localStorage, поднимаем его в состояние,
    // чтобы на главном экране сразу была кнопка «Продолжить прохождение».
    if (stage === "test" && seed) setDraft({ variant, seed, answers, index });
    setResults(null);
    setStage("intro");
    tap();
  };

  // Шапочное «Назад» всегда ведёт в главное меню теста, шаг назад по вопросам — кнопкой снизу.
  const back = () => {
    if (stage === "intro") { onClose(); return; }
    toIntro();
  };

  const prevQuestion = () => {
    if (index > 0) { setIndex(index - 1); tap(); return; }
    setStage("instruction");
    tap();
  };

  return (
    <AnimatePresence>
      <Shell progress={progress} showBar={stage === "test"} showExit={stage === "test"} onBack={back} onClose={onClose}>
        {stage === "intro" && (
          <Intro
            variant={variant}
            saved={saved}
            draft={draft}
            onPick={setVariant}
            onStart={() => { tap(); start(variant); }}
            onResume={() => { tap(); resume(); }}
            onOpenSaved={() => { tap(); openSaved(); }}
          />
        )}
        {stage === "instruction" && <Instruction variant={variant} onStart={() => { tap(); setStage("test"); }} />}
        {stage === "test" && questions[index] && (
          <TestStep
            question={questions[index]}
            index={index}
            total={questions.length}
            picked={answers[questions[index].id]}
            onAnswer={answer}
            onBack={prevQuestion}
          />
        )}
        {stage === "result" && results && (
          <Result results={results} onMenu={toIntro} />
        )}
      </Shell>
    </AnimatePresence>
  );
}

function Shell({ progress, showBar, showExit, onBack, onClose, children }: { progress: number; showBar: boolean; showExit: boolean; onBack: () => void; onClose: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = old; };
  }, []);
  return (
    <motion.div
      className="fixed inset-0 z-[90] flex justify-center bg-[rgba(32,28,24,.38)] p-0 @md:items-center @md:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.section
        className="flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[var(--surface)] @md:h-[min(844px,94dvh)] @md:rounded-[27px]"
        initial={reduce ? false : { y: 28, opacity: .7 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: 20, opacity: 0 }}
        transition={{ duration: .24, ease: [0.32, 0.72, 0, 1] }}
        style={{ border: `var(--bw-lg) solid ${TONE.edge}`, "--edge": TONE.edge } as CSSProperties}
      >
        <header className="shrink-0 px-4 pb-10 pt-[max(22px,calc(var(--top-pad)+10px))]" style={{ background: TONE.head }}>
          <div className="relative flex items-center gap-3">
            <button onClick={onBack} className="back-link shrink-0" style={{ color: TONE.edge }}>Назад</button>
            <span className="pointer-events-none absolute left-1/2 max-w-[calc(100%-190px)] -translate-x-1/2 truncate rounded-[12px] bg-white px-3 py-1.5 font-tight text-[14px] font-black leading-tight" style={{ color: TONE.edge }}>Тест на тип личности</span>
            {showExit ? (
              <button onClick={onClose} className="ml-auto shrink-0 rounded-[12px] bg-white px-3 py-2 text-[12px] font-black transition-transform duration-150 active:scale-[.97]" style={{ color: TONE.edge, border: `var(--bw) solid ${TONE.edge}` }}>Выйти</button>
            ) : (
              <span className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white" style={{ border: `var(--bw) solid ${TONE.edge}` }}><Icon name="chart" width={20} weight="bold" /></span>
            )}
          </div>
          {/* Шкала нужна только пока тест заполняется — на входе и в отчёте она пустая. */}
          {showBar && (
            <div className="mt-6">
              <div className="h-3.5 rounded-full bg-white p-[3px]" style={{ border: `var(--bw) solid ${TONE.edge}` }}>
                <motion.div className="h-full rounded-full" animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }} transition={{ duration: .28, ease: [0.32, 0.72, 0, 1] }} style={{ background: "var(--green-edge)" }} />
              </div>
            </div>
          )}
        </header>
        <div className="relative -mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[27px] bg-[var(--surface)] px-4 pb-[max(24px,var(--safe-bottom))] pt-6">{children}</div>
      </motion.section>
    </motion.div>
  );
}

function Primary({ onClick, icon, children }: { onClick: () => void; icon?: IconName; children: ReactNode }) {
  return (
    <button onClick={onClick} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--ink)] py-3.5 text-[14px] font-black text-white transition-transform duration-150 active:scale-[.98]">
      {icon && <Icon name={icon} width={18} weight="bold" color="#fff" />}
      {children}
    </button>
  );
}

function Bullets({ items, tone = "muted" }: { items: string[]; tone?: "muted" | "ink" }) {
  return (
    <ul className="mt-2 space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE.edge }} />
          <span className={`text-[12.5px] font-semibold leading-relaxed ${tone === "muted" ? "text-[var(--muted)]" : ""}`}>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, icon, hint, children }: { title: string; icon?: IconName; hint?: string; children: ReactNode }) {
  const [openHint, setOpenHint] = useState(false);
  return (
    <section className="mt-4 rounded-[18px] bg-white p-4" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      <div className="flex items-center gap-2">
        {icon && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]" style={{ background: TONE.soft }}><Icon name={icon} width={15} weight="bold" color={TONE.edge} /></span>}
        <h3 className="font-tight text-[15px] font-black leading-tight">{title}</h3>
        {hint && (
          <button onClick={() => { tap(); setOpenHint(!openHint); }} aria-label="Пояснение" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: TONE.soft }}>
            <Icon name="question" width={12} weight="bold" color={TONE.edge} />
          </button>
        )}
      </div>
      {hint && (
        <Disclosure open={openHint}>
          <p className="mt-2 rounded-[10px] p-2.5 text-[11.5px] font-semibold leading-relaxed" style={{ background: TONE.soft }}>{hint}</p>
        </Disclosure>
      )}
      {children}
    </section>
  );
}

function Intro({ variant, saved, draft, onPick, onStart, onResume, onOpenSaved }: {
  variant: Variant;
  saved: Saved | null;
  draft: Draft | null;
  onPick: (v: Variant) => void;
  onStart: () => void;
  onResume: () => void;
  onOpenSaved: () => void;
}) {
  return (
    <div>
      <h2 className="font-tight text-[25px] font-black leading-[1.05]">Тест покажет персональные сведения детально под Вас</h2>
      <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[var(--muted)]">Основан в соответствии с диагностическим руководством для DSM-5. На других площадках, как правило, предоставляют общие сведения. Этот тест дает персональную оценку и рекомендации.</p>

      {draft && (
        <button onClick={onResume} className="mt-4 flex w-full items-center gap-2.5 bg-transparent py-1 text-left" style={{ color: "var(--green-edge)" }}>
          <Icon name="warn" width={19} weight="fill" color="var(--green-edge)" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black">Продолжить прохождение</span>
            <span className="block text-[11px] font-semibold text-[var(--muted)]">отвечено {Object.keys(draft.answers).length} из {draft.variant}</span>
          </span>
        </button>
      )}

      {saved && (
        <button onClick={onOpenSaved} className="mt-2.5 flex w-full items-center gap-3 rounded-[16px] bg-white p-3 text-left" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]" style={{ background: TONE.soft }}><Icon name="note" width={19} weight="bold" color={TONE.edge} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black">Прошлый результат</span>
            <span className="block text-[11px] font-semibold text-[var(--muted)]">{dateLabel(saved.completedAt)} · {saved.variant} вопросов</span>
          </span>
        </button>
      )}

      <Block title="Как устроен тест" hint="Утверждения перемешаны и разложены по десяти шкалам. Чем ровнее вы отвечаете, тем точнее итоговые проценты.">
        <Bullets items={[
          "10 шкал соответствуют чертам личности из модели AMPD DSM-5",
          "каждая шкала указывает процентное выражение",
          "чем больше вопросов, тем точнее результат",
          "итоговое значение не является клиническим диагнозом",
        ]} />
      </Block>

      <div className="mt-4">
        <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Версия теста</p>
        <div className="mt-2 space-y-2">
          {VARIANTS.map((v) => (
            <button
              key={v.n}
              onClick={() => { select(); onPick(v.n); }}
              className="flex w-full items-center gap-3 rounded-[16px] p-3 text-left transition-transform duration-150 active:scale-[.99]"
              style={{ background: variant === v.n ? TONE.soft : "#fff", border: `var(--bw) solid ${variant === v.n ? TONE.edge : "var(--edge-neutral)"}` }}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ border: `2px solid ${variant === v.n ? TONE.edge : "var(--edge-neutral)"}` }}>
                {variant === v.n && <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE.edge }} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black">{v.label}</span>
                <span className="block text-[11px] font-semibold text-[var(--muted)]">примерно {v.est}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Primary onClick={onStart} icon="chart">Пройти тест</Primary>
      <p className="mt-3 text-center text-[10.5px] font-semibold leading-relaxed text-[var(--muted-2)]">{DISCLAIMER} Ответы остаются на этом устройстве.</p>
    </div>
  );
}

function Instruction({ variant, onStart }: { variant: Variant; onStart: () => void }) {
  return (
    <div>
      <h2 className="font-tight text-[25px] font-black leading-[1.05]">Инструкция</h2>
      <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[var(--muted)]">Впереди {variant} утверждений. Отвечайте по первому впечатлению — так профиль получается точнее.</p>
      <Block title="Как отвечать">
        <Bullets items={[
          "отвечайте быстро, без поиска идеального варианта",
          "оценивайте, как вы обычно ведёте себя в жизни, особенно в стрессе",
          "если сомневаетесь, выбирайте «скорее да» или «скорее нет»",
          "тест не ставит диагнозов и описывает выраженность паттернов",
        ]} />
      </Block>
      <div className="mt-4 flex gap-2 rounded-[14px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
        <Icon name="spark" width={17} weight="bold" />
        <p className="text-[11px] font-semibold leading-relaxed text-[var(--muted)]">Можно прерваться в любой момент: ответы сохраняются, и тест продолжится с того же вопроса.</p>
      </div>
      <Primary onClick={onStart}>Приступить</Primary>
    </div>
  );
}

function TestStep({ question, index, total, picked, onAnswer, onBack }: {
  question: Question;
  index: number;
  total: number;
  picked: number | undefined;
  onAnswer: (v: number) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--ink)]">
          Вопрос <span className="tnum" style={{ color: TONE.edge }}>{index + 1}</span> из <span className="tnum" style={{ color: TONE.edge }}>{total}</span>
        </p>
        <span className="tnum text-[12px] font-black" style={{ color: TONE.edge }}>{Math.round((index / total) * 100)}%</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: .18, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="mt-3 flex min-h-[132px] items-center rounded-[20px] bg-white p-4" style={{ border: `var(--bw-lg) solid ${TONE.edge}` }}>
            <p className="font-tight text-[19px] font-black leading-[1.2]">{question.text}</p>
          </div>

          <div className="mt-4 space-y-2">
            {ANSWERS.map((a) => (
              <button
                key={a.value}
                onClick={() => onAnswer(a.value)}
                className="flex w-full items-center gap-3 rounded-[16px] p-3.5 text-left transition-transform duration-150 active:scale-[.99]"
                style={{ background: picked === a.value ? TONE.soft : "#fff", border: `var(--bw) solid ${picked === a.value ? TONE.edge : "var(--edge-neutral)"}` }}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ border: `2px solid ${picked === a.value ? TONE.edge : "var(--edge-neutral)"}` }}>
                  {picked === a.value && <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE.edge }} />}
                </span>
                <span className="text-[13.5px] font-black">{a.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <button onClick={onBack} className="back-link mt-5 w-full justify-center">{index === 0 ? "К инструкции" : "Предыдущий вопрос"}</button>
    </div>
  );
}

function ScaleRow({ row }: { row: ScaleResult }) {
  const [open, setOpen] = useState(false);
  const tone = STATE_TONE[row.state];
  return (
    <div className="rounded-[16px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      <button onClick={() => { tap(); setOpen(!open); }} className="w-full text-left">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-black">{row.title}</span>
          <span className="tnum shrink-0 font-tight text-[15px] font-black">{row.percent}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: TRACK }}>
          <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${row.percent}%` }} transition={{ duration: .5, ease: [0.32, 0.72, 0, 1] }} style={{ background: tone.bar }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="chip" style={{ background: tone.bg, color: tone.edge }}>{tone.label}</span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]">
            <ArrowGlyph size={12} className="transition-transform" style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)" }} />
            {open ? "свернуть" : "подробнее"}
          </span>
        </div>
      </button>
      <Disclosure open={open}>
        <div className="pt-3">
          <p className="font-tight text-[14px] font-black leading-tight">{row.stateTitle}</p>
          <p className="mt-1.5 text-[12.5px] font-semibold leading-relaxed text-[var(--muted)]">{row.details.what}</p>
          <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-[var(--muted)]">{row.details.how}</p>
          <div className="mt-2.5 rounded-[12px] p-3" style={{ background: TONE.soft }}>
            <p className="text-[12.5px] font-semibold leading-relaxed">{row.details.help}</p>
          </div>
        </div>
      </Disclosure>
    </div>
  );
}

// Радар по десяти шкалам — тот же язык, что у колеса баланса.
function TraitRadar({ results, size = 252 }: { results: ScaleResult[]; size?: number }) {
  const map = useMemo(() => {
    const m: Record<string, ScaleResult> = {};
    for (const r of results) m[r.code] = r;
    return m;
  }, [results]);

  const pad = 46;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - pad;
  const n = SCALES.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  const val = (i: number) => map[SCALES[i].code]?.percent ?? 0;

  const ringPath = (level: number) =>
    SCALES.map((_, i) => { const [x, y] = pt(i, (R * level) / 100); return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ") + " Z";
  const dataPath =
    SCALES.map((_, i) => { const [x, y] = pt(i, (R * val(i)) / 100); return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
      {[20, 40, 60, 80, 100].map((lvl) => (
        <path key={lvl} d={ringPath(lvl)} fill={lvl === 100 ? "#fff" : "none"} stroke="var(--edge-neutral)" strokeWidth={lvl === 100 ? 2 : 1} opacity={lvl === 100 ? 1 : 0.5} />
      ))}
      {SCALES.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--edge-neutral)" strokeWidth={1} opacity={0.5} />; })}

      <motion.path
        d={dataPath} fill="var(--purple)" fillOpacity={0.35} stroke="var(--purple-edge)" strokeWidth={2.5} strokeLinejoin="round"
        initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 16 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {SCALES.map((s, i) => {
        const [x, y] = pt(i, (R * val(i)) / 100);
        const tone = STATE_TONE[map[s.code]?.state ?? "low"];
        return (
          <motion.circle key={s.code} cx={x} cy={y} r={4.5} fill={tone.bar} stroke={tone.edge} strokeWidth={2}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15 + i * 0.03, type: "spring", stiffness: 300, damping: 18 }} />
        );
      })}

      {SCALES.map((s, i) => {
        const [x, y] = pt(i, R + 16);
        const a = angle(i);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        return <text key={s.code} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fill-[var(--ink)] text-[8.5px] font-black uppercase" style={{ letterSpacing: ".02em" }}>{s.short}</text>;
      })}
    </svg>
  );
}

function Lead({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-tight text-[14px] font-black leading-tight">{title}</p>
      {children}
    </div>
  );
}

function pdfBlocks(report: ReturnType<typeof buildReport>, results: ScaleResult[]): PdfBlock[] {
  const hex: Record<State, string> = { low: "#aec89d", mid: "#f3ce77", high: "#ef9f8d" };
  const out: PdfBlock[] = [{ k: "h1", text: "Ваш результат" }, { k: "p", text: report.title }];

  out.push({ k: "h2", text: "Что показал тест" }, { k: "p", text: report.intro });
  for (const t of report.portrait) out.push({ k: "p", text: t });

  out.push({ k: "h2", text: "Все шкалы" });
  for (const r of results) out.push({ k: "bar", text: r.title, percent: r.percent, note: `${STATE_TONE[r.state].label} · ${r.stateTitle}`, color: hex[r.state] });

  const list = (title: string, items: string[]) => {
    if (!items.length) return;
    out.push({ k: "h2", text: title });
    for (const t of items) out.push({ k: "li", text: t });
  };
  list("Как это проявляется", report.manifestations);
  list("На что можно опереться", report.strengths);
  list("Сочетания выраженных особенностей", report.pairs);
  list("Ближайшие шаги", report.steps);
  if (report.practices.length) {
    out.push({ k: "h2", text: "Техники саморегуляции" });
    for (const p of report.practices) out.push({ k: "li", text: `${p.title} — ${p.text}` });
  }
  list("Рекомендации по выраженным шкалам", report.recommendations);
  list("Как читать проценты", report.ranges);

  out.push({ k: "note", text: DISCLAIMER });
  return out;
}

function Result({ results, onMenu }: { results: ScaleResult[]; onMenu: () => void }) {
  const report = useMemo(() => buildReport(results), [results]);
  const ordered = useMemo(() => SCALES.map((s) => results.find((r) => r.code === s.code)).filter(Boolean) as ScaleResult[], [results]);
  const [byScale, setByScale] = useState(false);
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    if (sharing) return;
    tap();
    setSharing(true);
    try {
      const { buildReportPdf, sharePdf } = await import("@/lib/trait-report-pdf");
      const blob = await buildReportPdf(pdfBlocks(report, results));
      await sharePdf(blob, "tip-lichnosti.pdf", "Результат теста на тип личности");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div>
      <div className="rounded-[22px] p-4 pt-5" style={{ background: TONE.soft }}>
        <h2 className="font-tight text-[23px] font-black leading-[1.05]">Ваш результат</h2>
        <div className="mt-3"><TraitRadar results={results} /></div>
        <div className="mt-2 space-y-1.5">
          {report.keyIndicators.map((k) => (
            <div key={k.title} className="flex items-center justify-between rounded-[12px] bg-white px-3 py-2">
              <span className="text-[12.5px] font-black">{k.title}</span>
              <span className="tnum text-[13px] font-black" style={{ color: TONE.edge }}>{k.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      <Lead title={report.title}>
        <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-[var(--muted)]">{report.intro}</p>
      </Lead>
      {report.portrait.length > 0 && (
        <Lead title="Как это выглядит в жизни">
          {report.portrait.map((t, i) => (
            <p key={i} className="mt-1.5 text-[13px] font-semibold leading-relaxed text-[var(--muted)]">{t}</p>
          ))}
        </Lead>
      )}

      <div className="mb-2 mt-6 flex items-center justify-between">
        <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Все шкалы</p>
        <button onClick={() => { tap(); setByScale(!byScale); }} className="text-[11px] font-black" style={{ color: TONE.edge }}>
          {byScale ? "по выраженности" : "по порядку шкал"}
        </button>
      </div>
      <div className="space-y-2">
        {(byScale ? ordered : results).map((row) => <ScaleRow key={row.code} row={row} />)}
      </div>

      <Block title="Как это проявляется" icon="waves">
        <Bullets items={report.manifestations} />
      </Block>

      <Block title="На что можно опереться" icon="clover">
        <Bullets items={report.strengths} />
      </Block>

      {report.pairs.length > 0 && (
        <Block title="Сочетания выраженных особенностей" icon="swap">
          <Bullets items={report.pairs} />
        </Block>
      )}

      <Block title="Ближайшие шаги" icon="steps">
        <Bullets items={report.steps} />
      </Block>

      {report.practices.length > 0 && (
        <Block title="Техники саморегуляции" icon="therapy">
          <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[var(--muted)]">Начните с одной, которая кажется применимой прямо сейчас.</p>
          <div className="mt-3 space-y-2">
            {report.practices.map((p) => (
              <div key={p.title} className="rounded-[14px] p-3" style={{ background: TONE.soft }}>
                <p className="text-[12.5px] font-black">{p.title}</p>
                <p className="mt-1 text-[12.5px] font-semibold leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </Block>
      )}

      {report.recommendations.length > 0 && (
        <Block title="Рекомендации по выраженным шкалам" icon="note">
          <Bullets items={report.recommendations} />
        </Block>
      )}

      <Block title="Как читать проценты" icon="chart">
        <Bullets items={report.ranges} />
      </Block>

      <Primary onClick={onMenu} icon="home">Главное меню</Primary>
      <button
        onClick={share}
        disabled={sharing}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-white py-3.5 text-[14px] font-black transition-transform duration-150 active:scale-[.98] disabled:opacity-60"
        style={{ border: `var(--bw) solid ${TONE.edge}`, color: TONE.edge }}
      >
        <Icon name="share" width={18} weight="bold" color={TONE.edge} />
        {sharing ? "Готовим PDF…" : "Поделиться результатом"}
      </button>
      <p className="mt-3 text-center text-[10.5px] font-semibold leading-relaxed text-[var(--muted-2)]">{DISCLAIMER}</p>
    </div>
  );
}
