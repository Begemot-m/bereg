"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { WHEEL, WHEEL_QUESTION_COUNT, wheelBand, type WheelAnswers } from "@/lib/therapy";
import { select, success, tap } from "@/lib/haptics";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const HelpFrame = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[132px] flex-col justify-center gap-2 rounded-[16px] p-3" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>{children}</div>
);

export const WHEEL_HELP: HelpPage[] = [
  {
    title: "Колесо баланса — 10 сфер жизни",
    text: `Расширенная методика на основе Wheel of Life, Индекса благополучия ВОЗ и опросника ценностей. ${WHEEL_QUESTION_COUNT} коротких утверждений собираются в наглядное колесо.`,
    illo: (
      <HelpFrame>
        <div className="grid grid-cols-2 gap-1.5">
          {WHEEL.slice(0, 6).map((d) => (
            <div key={d.key} className="flex items-center gap-1.5 rounded-[9px] bg-white px-2 py-1" style={{ border: `var(--bw) solid ${d.edge}` }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color, border: `1px solid ${d.edge}` }} />
              <span className="text-[9px] font-black">{d.short}</span>
            </div>
          ))}
        </div>
      </HelpFrame>
    ),
  },
  {
    title: "Оцените каждое утверждение",
    text: "По каждой сфере — три утверждения. Двигайте ползунок от 0 (совсем не про меня) до 10 (полностью про меня). Отвечайте про то, как сейчас, без правильных ответов.",
    illo: (
      <HelpFrame>
        <p className="text-[10px] font-black">Мне хватает сил и энергии на день</p>
        <div className="relative h-6 rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--purple)]" style={{ width: "70%" }} />
          <span className="absolute left-[70%] top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--ink)] text-[10px] font-black text-white">7</span>
        </div>
      </HelpFrame>
    ),
  },
  {
    title: "Колесо покажет перекос",
    text: "Сферы, где меньше всего баланса, подсветятся отдельно — с них удобно начать разговор с терапевтом. Пройти колесо заново можно в любой момент, чтобы видеть динамику.",
    illo: (
      <HelpFrame>
        {[["Работа", 30], ["Отдых", 40], ["Отношения", 80]].map(([label, w]) => (
          <div key={label as string} className="flex items-center gap-2">
            <span className="w-16 text-[9px] font-bold text-[var(--muted)]">{label}</span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><div className="h-full rounded-full bg-[var(--purple)]" style={{ width: `${w}%` }} /></div>
          </div>
        ))}
      </HelpFrame>
    ),
  },
];

function initAnswers(): WheelAnswers {
  const a: WheelAnswers = {};
  for (const d of WHEEL) a[d.key] = d.questions.map(() => 5);
  return a;
}

export function WheelFlow({ guide, onClose, onGuideSeen, onSave }: { guide: boolean; onClose: () => void; onGuideSeen: () => void; onSave: (answers: WheelAnswers) => void }) {
  const [testing, setTesting] = useState(!guide);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WheelAnswers>(initAnswers);
  if (!testing) return <HelpDeck title="Колесо баланса" pages={WHEEL_HELP} onClose={onClose} doneLabel="Пройти колесо" onDone={() => { onGuideSeen(); setTesting(true); }} />;

  const domain = WHEEL[step];
  const last = step === WHEEL.length - 1;
  const setVal = (qi: number, v: number) => setAnswers((s) => ({ ...s, [domain.key]: s[domain.key].map((x, i) => (i === qi ? v : x)) }));
  const next = () => { if (last) { success(); onSave(answers); onClose(); } else { select(); setStep((v) => v + 1); } };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center" onClick={onClose}>
        <motion.div initial={{ y: 34 }} animate={{ y: 0 }} exit={{ y: 34, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} onClick={(e) => e.stopPropagation()} className="chunk w-full max-w-md overflow-hidden bg-[#fffdf7]">
          <div className="flex items-center justify-between bg-[var(--purple)] px-5 py-4" style={{ borderBottom: "var(--bw-lg) solid var(--purple-edge)" }}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name={domain.icon} width={18} weight="bold" /></span>
              <div><p className="text-[10px] font-black uppercase tracking-[.12em]">Сфера {step + 1} из {WHEEL.length}</p><p className="text-[14px] font-black leading-tight">{domain.label}</p></div>
            </div>
            <button onClick={() => { tap(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[14px] font-black stroke" aria-label="Закрыть">×</button>
          </div>
          <div className="p-5">
            <div className="mb-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${WHEEL.length}, 1fr)` }}>{WHEEL.map((_, i) => <span key={i} className="h-2 rounded-full" style={{ background: i <= step ? "var(--purple)" : "#fff", border: "var(--bw) solid var(--purple-edge)" }} />)}</div>
            <motion.div key={domain.key} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
              {domain.questions.map((q, qi) => (
                <div key={qi}>
                  <p className="mb-2 text-[13px] font-bold leading-snug">{q}</p>
                  <Scale value={answers[domain.key][qi]} onChange={(v) => setVal(qi, v)} />
                </div>
              ))}
            </motion.div>
            <div className="mt-5 flex gap-2">
              {step > 0 && <Button variant="soft" onClick={() => { tap(); setStep((v) => v - 1); }}>Назад</Button>}
              <Button className="flex-1" onClick={next}>{last ? `Готово · ${wheelBand(wheelPctLocal(answers)).label}` : "Дальше"}</Button>
            </div>
            <p className="mt-3 text-center text-[10px] font-semibold text-[var(--muted-2)]">Самооценка для разговора с терапевтом · не диагноз.</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function wheelPctLocal(a: WheelAnswers): number {
  const per = WHEEL.map((d) => a[d.key].reduce((s, v) => s + v, 0) / a[d.key].length);
  return Math.round((per.reduce((s, v) => s + v, 0) / per.length) * 10);
}

// Ползунок 0–10 с бегунком-значением.
function Scale({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const set = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const v = Math.round(clamp((clientX - r.left) / r.width, 0, 1) * 10);
    if (v !== value) { select(); onChange(v); }
  };
  return (
    <div ref={ref} onPointerDown={(e) => { drag.current = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); set(e.clientX); }} onPointerMove={(e) => { if (drag.current) set(e.clientX); }} onPointerUp={() => { drag.current = false; }} className="relative h-8 cursor-pointer touch-none select-none">
      <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full" style={{ background: "#fff", border: "var(--bw) solid var(--purple-edge)" }} />
      <div className="absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[var(--purple)]" style={{ width: `${value * 10}%` }} />
      <div className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--ink)] text-[12px] font-black text-white" style={{ left: `${value * 10}%`, border: "var(--bw) solid var(--ink)" }}>{value}</div>
    </div>
  );
}
