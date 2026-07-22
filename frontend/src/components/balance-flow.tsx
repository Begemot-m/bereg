"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { WHEEL, WHEEL_QUESTION_COUNT, wheelBand, type WheelAnswers, type WheelResult } from "@/lib/therapy";
import { WheelChart } from "@/components/wheel-chart";
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

export function WheelFlow({ guide, onClose, onGuideSeen, onSave, locked = false, onUnlock }: { guide: boolean; onClose: () => void; onGuideSeen: () => void; onSave: (answers: WheelAnswers) => void; locked?: boolean; onUnlock?: () => void }) {
  const [testing, setTesting] = useState(!guide);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WheelAnswers>(initAnswers);
  if (!testing) return <HelpDeck title="Колесо баланса" pages={WHEEL_HELP} onClose={onClose} doneLabel="Пройти колесо" onDone={() => { onGuideSeen(); setTesting(true); }} />;

  const summary = step === WHEEL.length;
  const domain = WHEEL[step];
  const pct = wheelPctLocal(answers);
  const band = wheelBand(pct);
  const filled = summary ? WHEEL.length : step;
  const next = () => { if (step === WHEEL.length - 1) { success(); setStep(WHEEL.length); } else { select(); setStep((v) => v + 1); } };
  const setVal = (qi: number, v: number) => domain && setAnswers((s) => ({ ...s, [domain.key]: s[domain.key].map((x, i) => (i === qi ? v : x)) }));

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center" onClick={onClose}>
        <motion.div initial={{ y: 34 }} animate={{ y: 0 }} exit={{ y: 34, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} onClick={(e) => e.stopPropagation()} className="chunk max-h-[92dvh] w-full max-w-md overflow-y-auto bg-[#fffdf7]">
          <div className="sticky top-0 z-[1] bg-[var(--purple)] px-5 py-4" style={{ borderBottom: "var(--bw-lg) solid var(--purple-edge)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name={summary ? "balance" : domain.icon} width={18} weight="bold" /></span>
                <div><p className="text-[10px] font-black uppercase tracking-[.12em]">{summary ? "Ваш результат" : `Сфера ${step + 1} из ${WHEEL.length}`}</p><p className="text-[14px] font-black leading-tight">{summary ? "Колесо собрано" : domain.label}</p></div>
              </div>
              <button onClick={() => { tap(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[14px] font-black stroke" aria-label="Закрыть">×</button>
            </div>
            {/* Прогресс-бар со статой */}
            <div className="mt-3 flex items-center gap-2.5">
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[#fffdf7]" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
                <motion.div className="h-full rounded-full bg-[var(--ink)]" animate={{ width: `${(filled / WHEEL.length) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 24 }} />
              </div>
              <span className="tnum rounded-full bg-[#fffdf7] px-2 py-0.5 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>{pct}%</span>
            </div>
          </div>

          <div className="p-5">
            {summary ? (
              <ResultView answers={answers} pct={pct} band={band} locked={locked} onSave={() => { success(); onSave(answers); onClose(); }} onUnlock={onUnlock} />
            ) : (
              <>
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
                  <Button className="flex-1" onClick={next}>{step === WHEEL.length - 1 ? "Показать результат" : "Дальше"}</Button>
                </div>
                <p className="mt-3 text-center text-[10px] font-semibold text-[var(--muted-2)]">Самооценка для разговора с терапевтом · не диагноз.</p>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Экран результата: круглое колесо (радар), сильные/слабые сферы и (для клиента без Вдох+) оплата.
function ResultView({ answers, pct, band, locked, onSave, onUnlock }: { answers: WheelAnswers; pct: number; band: ReturnType<typeof wheelBand>; locked: boolean; onSave: () => void; onUnlock?: () => void }) {
  const per = WHEEL.map((d) => ({ d, v: d.questions.reduce((s, _, i) => s + answers[d.key][i], 0) / d.questions.length })).sort((a, b) => b.v - a.v);
  const tone = band.tone === "green" ? "var(--green)" : band.tone === "amber" ? "var(--amber)" : "var(--salmon)";
  const edge = band.tone === "green" ? "var(--green-edge)" : band.tone === "amber" ? "var(--amber-edge)" : "var(--salmon-edge)";
  const strong = per.slice(0, 2), weak = per.slice(-2).reverse();
  const result: WheelResult = { answers, completedAt: new Date().toISOString() };

  return (
    <div className="space-y-4">
      {/* Круглое колесо баланса — как на странице терапии */}
      <div className="rounded-[18px] p-3 pt-4" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>
        <WheelChart result={result} size={252} />
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase" style={{ background: tone, border: `var(--bw) solid ${edge}` }}>{band.label}</span>
          <span className="tnum text-[13px] font-black">{pct}%</span>
        </div>
        <p className="mt-1.5 text-center text-[11px] font-semibold leading-snug text-[var(--muted)]">{band.hint}</p>
      </div>

      {/* Сильные / слабые сферы */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard title="Опора" items={strong} good />
        <StatCard title="Внимание" items={weak} />
      </div>

      {locked ? (
        <div className="rounded-[18px] p-4" style={{ background: "var(--purple-soft)", border: "var(--bw-lg) solid var(--purple-edge)" }}>
          <div className="flex items-center gap-2"><Icon name="therapy" width={18} weight="fill" /><p className="text-[13px] font-black">Полный разбор в Вдох+</p></div>
          <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Детальный радар по 10 сферам, история и динамика от встречи к встрече — по подписке 390 ₽/мес.</p>
          <button onClick={() => { tap(); onUnlock?.(); }} className="mt-3 w-full rounded-[13px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white transition-transform active:scale-[0.98]">Открыть Вдох+ · 390 ₽/мес</button>
          <button onClick={onSave} className="mt-2 w-full text-center text-[12px] font-bold text-[var(--muted)]">Пока сохранить базовый результат</button>
        </div>
      ) : (
        <Button className="w-full" onClick={onSave}>Сохранить результат</Button>
      )}
      <p className="text-center text-[10px] font-semibold text-[var(--muted-2)]">Самооценка для разговора с терапевтом · не диагноз.</p>
    </div>
  );
}

function StatCard({ title, items, good }: { title: string; items: { d: (typeof WHEEL)[number]; v: number }[]; good?: boolean }) {
  return (
    <div className="rounded-[15px] bg-white p-3" style={{ border: `var(--bw) solid ${good ? "var(--green-edge)" : "var(--salmon-edge)"}` }}>
      <p className="text-[10px] font-black uppercase tracking-[.06em]" style={{ color: good ? "var(--green-edge)" : "var(--salmon-edge)" }}>{title}</p>
      <div className="mt-1.5 space-y-1">
        {items.map(({ d, v }) => (
          <div key={d.key} className="flex items-center justify-between gap-1"><span className="truncate text-[11px] font-bold">{d.short}</span><span className="tnum text-[11px] font-black text-[var(--muted)]">{v.toFixed(1)}</span></div>
        ))}
      </div>
    </div>
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
