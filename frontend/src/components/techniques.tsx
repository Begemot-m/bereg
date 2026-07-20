"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { select, success, tap } from "@/lib/haptics";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const TONE: Record<string, { bg: string; soft: string; edge: string }> = {
  sky: { bg: "var(--sky)", soft: "#d5e8ef", edge: "#5f95ab" },
  purple: { bg: "var(--purple)", soft: "var(--purple-soft)", edge: "var(--purple-edge)" },
  green: { bg: "var(--green)", soft: "var(--green-soft)", edge: "var(--green-edge)" },
  coral: { bg: "var(--coral)", soft: "var(--coral-soft)", edge: "var(--coral-edge)" },
  amber: { bg: "var(--amber)", soft: "var(--amber-soft)", edge: "var(--amber-edge)" },
};

export type TechKey = "breathing" | "thought" | "grounding" | "gad7";
export const TECH_META: Record<TechKey, { title: string; tone: keyof typeof TONE; icon: IconName; based: string }> = {
  breathing: { title: "Дыхание 4-7-8", tone: "sky", icon: "pulse", based: "методика Э. Вейла" },
  thought: { title: "Дневник мыслей", tone: "purple", icon: "note", based: "запись мыслей КПТ (А. Бек)" },
  grounding: { title: "Заземление 5-4-3-2-1", tone: "green", icon: "compass", based: "техника заземления при тревоге" },
  gad7: { title: "Шкала тревоги GAD-7", tone: "coral", icon: "chart", based: "валидированный опросник" },
};

// Оболочка техники: цветная шапка + скруглённый скролл-контент.
function TechShell({ tone, title, based, onClose, children }: { tone: keyof typeof TONE; title: string; based: string; onClose: () => void; children: ReactNode }) {
  const c = TONE[tone];
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 @md:items-center" onClick={onClose}>
      <motion.section initial={{ y: 36 }} animate={{ y: 0 }} exit={{ y: 36, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }} onClick={(e) => e.stopPropagation()} className="chunk max-h-[92dvh] w-full max-w-md overflow-y-auto p-0" style={{ background: "var(--surface)" }}>
        <div className="sticky top-0 z-[1] flex items-center justify-between px-5 py-4" style={{ background: `linear-gradient(150deg, ${c.bg}, ${c.soft})`, borderBottom: `var(--bw-lg) solid ${c.edge}` }}>
          <div><p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">{based}</p><h3 className="font-tight text-[18px] font-black leading-tight">{title}</h3></div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[15px] font-black stroke" aria-label="Закрыть">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </motion.section>
    </motion.div>
  );
}

export function TechniqueRunner({ tech, onClose }: { tech: TechKey; onClose: () => void }) {
  const meta = TECH_META[tech];
  return (
    <AnimatePresence>
      <TechShell tone={meta.tone} title={meta.title} based={meta.based} onClose={onClose}>
        {tech === "breathing" && <Breathing onClose={onClose} />}
        {tech === "thought" && <ThoughtRecord />}
        {tech === "grounding" && <Grounding />}
        {tech === "gad7" && <Gad7 />}
      </TechShell>
    </AnimatePresence>
  );
}

/* ============ Дыхание 4-7-8 ============ */
const PHASES = [
  { k: "Вдох", s: 4, scale: 1, tip: "медленно через нос" },
  { k: "Задержка", s: 7, scale: 1, tip: "не напрягаясь" },
  { k: "Выдох", s: 8, scale: 0.52, tip: "через рот, со звуком" },
];
function Breathing({ onClose }: { onClose: () => void }) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(4);
  const [cycles, setCycles] = useState(0);
  const done = cycles >= 4;

  useEffect(() => {
    if (!running || done) return;
    setLeft(PHASES[phase].s);
    const iv = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) { clearInterval(iv); setPhase((ph) => { const nx = (ph + 1) % 3; if (nx === 0) { setCycles((x) => x + 1); success(); } else select(); return nx; }); return PHASES[phase].s; }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [running, phase, done]);

  const ph = PHASES[phase];
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-56 w-56 items-center justify-center">
        <motion.div className="absolute rounded-full" animate={{ scale: running && !done ? ph.scale : 0.7 }} transition={{ duration: running && !done ? ph.s : 0.6, ease: "easeInOut" }} style={{ width: 224, height: 224, background: "var(--sky)", border: "var(--bw-lg) solid #5f95ab", opacity: 0.5 }} />
        <motion.div className="absolute rounded-full" animate={{ scale: running && !done ? ph.scale : 0.7 }} transition={{ duration: running && !done ? ph.s : 0.6, ease: "easeInOut" }} style={{ width: 160, height: 160, background: "#d5e8ef", border: "var(--bw-lg) solid #5f95ab" }} />
        <div className="relative z-[1] text-center">
          {done ? (<><p className="font-tight text-[22px] font-black">Готово 🌿</p><p className="text-[12px] font-bold text-[var(--muted)]">4 цикла завершены</p></>)
            : running ? (<><p className="font-tight text-[24px] font-black leading-none">{ph.k}</p><p className="tnum mt-1 text-[34px] font-black leading-none">{left}</p><p className="mt-1 text-[11px] font-bold text-[var(--muted)]">{ph.tip}</p></>)
              : (<><p className="font-tight text-[20px] font-black">Готовы?</p><p className="text-[11px] font-bold text-[var(--muted)]">вдох 4 · пауза 7 · выдох 8</p></>)}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5">{[0, 1, 2, 3].map((i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: i < cycles ? "var(--ink)" : "#fff", border: "var(--bw) solid #5f95ab" }} />)}</div>

      <div className="mt-5 flex w-full gap-2">
        {done ? (
          <button onClick={() => { tap(); onClose(); }} className="w-full rounded-[15px] bg-[var(--ink)] py-3 text-[15px] font-black text-white">Завершить</button>
        ) : (
          <>
            <button onClick={() => { tap(); setRunning(!running); }} className="flex-1 rounded-[15px] py-3 text-[15px] font-black" style={running ? { background: "#fff", border: "var(--bw) solid var(--edge-neutral)" } : { background: "var(--ink)", color: "#fff" }}>{running ? "Пауза" : cycles ? "Продолжить" : "Начать"}</button>
            {(running || cycles > 0) && <button onClick={() => { tap(); setRunning(false); setPhase(0); setCycles(0); setLeft(4); }} className="rounded-[15px] bg-white px-4 py-3 text-[13px] font-black stroke">Сброс</button>}
          </>
        )}
      </div>
      <p className="mt-3 text-center text-[10px] font-semibold text-[var(--muted-2)]">Помогает успокоиться и заснуть. Если кружится голова — сделайте паузу.</p>
    </div>
  );
}

/* ============ Слайдер 0–100 ============ */
function Slider({ value, onChange, tone = "purple" }: { value: number; onChange: (v: number) => void; tone?: keyof typeof TONE }) {
  const c = TONE[tone];
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const set = (x: number) => { const r = ref.current?.getBoundingClientRect(); if (!r) return; const v = Math.round(clamp((x - r.left) / r.width, 0, 1) * 100); if (v !== value) { select(); onChange(v); } };
  return (
    <div ref={ref} onPointerDown={(e) => { drag.current = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); set(e.clientX); }} onPointerMove={(e) => { if (drag.current) set(e.clientX); }} onPointerUp={() => { drag.current = false; }} className="relative h-8 cursor-pointer touch-none select-none">
      <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-white" style={{ border: `var(--bw) solid ${c.edge}` }} />
      <div className="absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full" style={{ width: `${value}%`, background: c.bg }} />
      <div className="absolute top-1/2 flex h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--ink)] px-1.5 text-[11px] font-black text-white" style={{ left: `${value}%`, border: "var(--bw) solid var(--ink)" }}>{value}</div>
    </div>
  );
}

/* ============ Дневник мыслей (КПТ) ============ */
const EMOTIONS = ["тревога", "грусть", "гнев", "стыд", "вина", "бессилие"];
const DISTORTIONS = ["Катастрофизация", "Чёрно-белое", "Чтение мыслей", "Сверхобобщение", "Долженствование", "Обесценивание", "Эмоц. вывод", "Ярлыки"];
type TR = { situation: string; thought: string; belief: number; emotion: string; before: number; distortions: string[]; alt: string; after: number; date: string };
function ThoughtRecord() {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<TR>({ situation: "", thought: "", belief: 70, emotion: "тревога", before: 70, distortions: [], alt: "", after: 40, date: "" });
  const [saved, setSaved] = useState(false);
  const upd = (p: Partial<TR>) => setD((s) => ({ ...s, ...p }));
  const toggleDist = (x: string) => upd({ distortions: d.distortions.includes(x) ? d.distortions.filter((y) => y !== x) : [...d.distortions, x] });
  const steps = 5;

  if (saved) return (
    <div className="text-center">
      <p className="text-[40px]">🌤️</p>
      <p className="font-tight text-[18px] font-black">Запись сохранена</p>
      <p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Вера в тревожную мысль: {d.belief}% → альтернатива помогает. Эмоция: {d.before} → {d.after}.</p>
      <button onClick={() => { setSaved(false); setStep(0); setD({ situation: "", thought: "", belief: 70, emotion: "тревога", before: 70, distortions: [], alt: "", after: 40, date: "" }); }} className="mt-4 rounded-full bg-[var(--head-soft)] px-4 py-2 text-[13px] font-black stroke">Новая запись</button>
    </div>
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-5 gap-1">{Array.from({ length: steps }, (_, i) => <span key={i} className="h-2 rounded-full" style={{ background: i <= step ? "var(--purple)" : "#fff", border: "var(--bw) solid var(--purple-edge)" }} />)}</div>
      {step === 0 && <Field label="Что произошло? Ситуация" hint="Коротко и по фактам, без оценок."><textarea value={d.situation} onChange={(e) => upd({ situation: e.target.value })} rows={3} className="tf" placeholder="Например: не ответили на сообщение весь день" /></Field>}
      {step === 1 && <div className="space-y-4"><Field label="Какая мысль пришла?" hint="Автоматическая мысль в тот момент."><textarea value={d.thought} onChange={(e) => upd({ thought: e.target.value })} rows={2} className="tf" placeholder="Я им безразличен" /></Field><div><p className="lbl">Насколько верю в неё: {d.belief}%</p><Slider value={d.belief} onChange={(v) => upd({ belief: v })} /></div></div>}
      {step === 2 && <div className="space-y-4"><div><p className="lbl">Что чувствую?</p><div className="flex flex-wrap gap-1.5">{EMOTIONS.map((e) => <button key={e} onClick={() => { select(); upd({ emotion: e }); }} className="rounded-full px-3 py-1.5 text-[12px] font-black" style={d.emotion === e ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", border: "var(--bw) solid var(--edge-neutral)" }}>{e}</button>)}</div></div><div><p className="lbl">Сила эмоции: {d.before}</p><Slider value={d.before} onChange={(v) => upd({ before: v })} tone="coral" /></div></div>}
      {step === 3 && <div><p className="lbl">Нет ли искажения в мысли?</p><p className="mb-2 text-[11px] font-semibold text-[var(--muted)]">Отметьте, что узнаёте.</p><div className="flex flex-wrap gap-1.5">{DISTORTIONS.map((x) => <button key={x} onClick={() => toggleDist(x)} className="rounded-full px-3 py-1.5 text-[12px] font-black" style={d.distortions.includes(x) ? { background: "var(--purple)", border: "var(--bw) solid var(--purple-edge)" } : { background: "#fff", border: "var(--bw) solid var(--edge-neutral)" }}>{x}</button>)}</div></div>}
      {step === 4 && <div className="space-y-4"><Field label="Более взвешенная мысль" hint="Что бы вы сказали близкому в такой ситуации?"><textarea value={d.alt} onChange={(e) => upd({ alt: e.target.value })} rows={3} className="tf" placeholder="Есть разные причины молчания, это не про меня" /></Field><div><p className="lbl">Сила эмоции теперь: {d.after}</p><Slider value={d.after} onChange={(v) => upd({ after: v })} tone="green" /></div></div>}

      <div className="mt-5 flex gap-2">
        {step > 0 && <button onClick={() => { tap(); setStep(step - 1); }} className="rounded-[14px] bg-white px-4 py-2.5 text-[13px] font-black stroke">Назад</button>}
        <button onClick={() => { tap(); if (step === steps - 1) { success(); setSaved(true); } else setStep(step + 1); }} className="flex-1 rounded-[14px] bg-[var(--ink)] py-2.5 text-[14px] font-black text-white">{step === steps - 1 ? "Сохранить запись" : "Дальше"}</button>
      </div>
    </div>
  );
}

/* ============ Заземление 5-4-3-2-1 ============ */
const SENSES = [
  { n: 5, verb: "вижу", tip: "Оглянитесь и назовите" },
  { n: 4, verb: "слышу", tip: "Прислушайтесь" },
  { n: 3, verb: "ощущаю кожей", tip: "Что касается тела" },
  { n: 2, verb: "чувствую по запаху", tip: "Вдохните" },
  { n: 1, verb: "чувствую на вкус", tip: "Обратите внимание" },
];
function Grounding() {
  const [step, setStep] = useState(0);
  const [vals, setVals] = useState<string[][]>(SENSES.map((s) => Array(s.n).fill("")));
  const [done, setDone] = useState(false);
  const s = SENSES[step];
  const setVal = (i: number, v: string) => setVals((cur) => cur.map((arr, si) => (si === step ? arr.map((x, xi) => (xi === i ? v : x)) : arr)));

  if (done) return (
    <div className="text-center">
      <p className="text-[40px]">🌱</p>
      <p className="font-tight text-[18px] font-black">Вы здесь и сейчас</p>
      <p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">Заземление помогает вернуться в настоящий момент, когда тревога уносит в мысли. Возвращайтесь к нему в любой момент.</p>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-center gap-2">{SENSES.map((x, i) => <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-black" style={i === step ? { background: "var(--green)", border: "var(--bw) solid var(--green-edge)" } : { background: i < step ? "var(--green-soft)" : "#fff", border: "var(--bw) solid var(--edge-neutral)", color: i < step ? "var(--green-edge)" : "var(--muted-2)" }}>{x.n}</span>)}</div>
      <p className="text-center text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">{s.tip}</p>
      <h4 className="mt-1 text-center font-tight text-[19px] font-black leading-tight">{s.n} {s.n === 1 ? "вещь, которую" : "вещей, которые"} {s.verb}</h4>
      <div className="mt-4 space-y-2">
        {Array.from({ length: s.n }, (_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-[13px] bg-white px-3" style={{ border: "var(--bw) solid var(--green-edge)" }}>
            <span className="text-[13px] font-black text-[var(--green-edge)]">{i + 1}</span>
            <input value={vals[step][i]} onChange={(e) => setVal(i, e.target.value)} placeholder="…" className="w-full bg-transparent py-2.5 text-[14px] font-semibold outline-none placeholder:text-[var(--muted-2)]" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        {step > 0 && <button onClick={() => { tap(); setStep(step - 1); }} className="rounded-[14px] bg-white px-4 py-2.5 text-[13px] font-black stroke">Назад</button>}
        <button onClick={() => { tap(); if (step === SENSES.length - 1) { success(); setDone(true); } else setStep(step + 1); }} className="flex-1 rounded-[14px] bg-[var(--ink)] py-2.5 text-[14px] font-black text-white">{step === SENSES.length - 1 ? "Готово" : "Дальше"}</button>
      </div>
    </div>
  );
}

/* ============ Шкала тревоги GAD-7 ============ */
const GAD7_Q = [
  "Нервозность, тревога или ощущение взвинченности",
  "Неспособность остановить или контролировать беспокойство",
  "Слишком сильное беспокойство по разным поводам",
  "Трудно расслабиться",
  "Беспокойство, из-за которого трудно усидеть на месте",
  "Лёгкая раздражимость",
  "Страх, будто может случиться что-то ужасное",
];
const GAD7_OPT = [{ v: 0, l: "Совсем нет" }, { v: 1, l: "Несколько дней" }, { v: 2, l: "Больше половины дней" }, { v: 3, l: "Почти каждый день" }];
function gad7Band(score: number) {
  if (score <= 4) return { label: "минимальная", tone: "green", hint: "Признаков тревоги почти нет." };
  if (score <= 9) return { label: "лёгкая", tone: "amber", hint: "Лёгкая тревога. Наблюдайте за собой." };
  if (score <= 14) return { label: "умеренная", tone: "coral", hint: "Умеренная тревога — стоит обсудить с терапевтом." };
  return { label: "выраженная", tone: "coral", hint: "Выраженная тревога. Рекомендуем обратиться к специалисту." };
}
function Gad7() {
  const [ans, setAns] = useState<(number | null)[]>(Array(7).fill(null));
  const [show, setShow] = useState(false);
  const score = ans.reduce<number>((s, v) => s + (v ?? 0), 0);
  const done = ans.every((v) => v !== null);
  const band = gad7Band(score);
  const c = TONE[band.tone];

  if (show) return (
    <div className="text-center">
      <div className="relative mx-auto h-[120px] w-[120px]">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90"><circle cx="60" cy="60" r="50" fill="none" stroke="#fff" strokeWidth="12" /><motion.circle cx="60" cy="60" r="50" fill="none" stroke={c.bg} strokeWidth="12" strokeLinecap="round" strokeDasharray={2 * Math.PI * 50} initial={{ strokeDashoffset: 2 * Math.PI * 50 }} animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - score / 21) }} transition={{ duration: 0.9 }} /></svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-tight tnum text-[30px] font-black leading-none">{score}</span><span className="text-[10px] font-black text-[var(--muted)]">из 21</span></div>
      </div>
      <span className="mt-3 inline-block rounded-full px-3 py-1 text-[12px] font-black uppercase" style={{ background: c.soft, border: `var(--bw) solid ${c.edge}` }}>{band.label} тревога</span>
      <p className="mx-auto mt-2 max-w-[280px] text-[12px] font-semibold text-[var(--muted)]">{band.hint}</p>
      <button onClick={() => { tap(); setAns(Array(7).fill(null)); setShow(false); }} className="mt-4 rounded-full bg-[var(--head-soft)] px-4 py-2 text-[13px] font-black stroke">Пройти заново</button>
      <p className="mt-3 text-[10px] font-semibold text-[var(--muted-2)]">Скрининг, а не диагноз. За две недели. Обсудите результат с терапевтом.</p>
    </div>
  );

  return (
    <div>
      <p className="mb-3 text-[12px] font-bold text-[var(--muted)]">Как часто за последние 2 недели вас беспокоило:</p>
      <div className="space-y-3">
        {GAD7_Q.map((q, i) => (
          <div key={i} className="rounded-[15px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
            <p className="text-[13px] font-bold leading-snug">{i + 1}. {q}</p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {GAD7_OPT.map((o) => (
                <button key={o.v} onClick={() => { select(); setAns((a) => a.map((x, xi) => (xi === i ? o.v : x))); }} className="rounded-[10px] px-1 py-1.5 text-[10px] font-black leading-tight" style={ans[i] === o.v ? { background: "var(--ink)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--muted)" }}>{o.l}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button disabled={!done} onClick={() => { success(); setShow(true); }} className="mt-4 w-full rounded-[14px] bg-[var(--ink)] py-3 text-[14px] font-black text-white disabled:opacity-40">{done ? "Показать результат" : `Ответьте на все (${ans.filter((v) => v !== null).length}/7)`}</button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block"><span className="lbl">{label}</span>{hint && <span className="mb-2 block text-[11px] font-semibold text-[var(--muted)]">{hint}</span>}{children}</label>;
}
