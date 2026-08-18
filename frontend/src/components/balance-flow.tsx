"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { WHEEL, WHEEL_QUESTION_COUNT, domainScore, wheelBand, wheelFocus, wheelPercent, type WheelAnswers, type WheelQuestion, type WheelResult } from "@/lib/therapy";
import { WheelChart } from "@/components/wheel-chart";
import { select, success, tap } from "@/lib/haptics";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const HelpFrame = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[132px] flex-col justify-center gap-2 rounded-[14px] p-3" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>{children}</div>
);

export const WHEEL_HELP: HelpPage[] = [
  {
    title: "Колесо баланса — 10 сфер жизни",
    text: `Методика собрана по Wheel of Life, Индексу личного благополучия (PWI) и опроснику ценностей. ${WHEEL_QUESTION_COUNT} вопросов — по два на сферу — складываются в наглядное колесо.`,
    illo: (
      <HelpFrame>
        <div className="grid grid-cols-2 gap-1.5">
          {WHEEL.slice(0, 6).map((d) => (
            <div key={d.key} className="flex items-center gap-1.5 rounded-[8px] bg-white px-2 py-1" style={{ border: `var(--bw) solid ${d.edge}` }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color, border: `1px solid ${d.edge}` }} />
              <span className="text-[9px] font-black">{d.short}</span>
            </div>
          ))}
        </div>
      </HelpFrame>
    ),
  },
  {
    title: "Два вопроса на сферу",
    text: "Сначала — насколько вы довольны тем, как сейчас. Потом — насколько эта сфера для вас важна. Ползунок от 0 до 10, правильных ответов нет.",
    illo: (
      <HelpFrame>
        <p className="text-[10px] font-black">Насколько вы довольны своим здоровьем, сном и запасом сил?</p>
        <div className="relative h-6 rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--purple)]" style={{ width: "70%" }} />
          <span className="absolute left-[70%] top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--ink)] text-[10px] font-black text-white">7</span>
        </div>
      </HelpFrame>
    ),
  },
  {
    title: "Колесо покажет, с чего начать",
    text: "Отдельно подсветятся сферы, которые вам важны и при этом проседают — с них удобно начать разговор с терапевтом. Низкая, но неважная сфера вытягивания не требует. Пройти колесо заново можно в любой момент, чтобы видеть динамику.",
    illo: (
      <HelpFrame>
        {[["Работа", 30], ["Отдых", 40], ["Любовь", 80]].map(([label, w]) => (
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

const asResult = (answers: WheelAnswers): WheelResult => ({ answers, completedAt: new Date().toISOString() });

export function WheelFlow({ guide, onClose, onGuideSeen, onSave, locked = false, onUnlock }: { guide: boolean; onClose: () => void; onGuideSeen: () => void; onSave: (answers: WheelAnswers) => void; locked?: boolean; onUnlock?: () => void }) {
  const [testing, setTesting] = useState(!guide);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WheelAnswers>(initAnswers);
  const persisted = useRef(false);
  const summaryReached = step === WHEEL.length;
  // Результат сохраняется сразу при показе — не зависит от того, какую кнопку нажмут.
  useEffect(() => { if (summaryReached && !persisted.current) { persisted.current = true; onSave(answers); } }, [summaryReached, answers, onSave]);
  if (!testing) return <HelpDeck title="Колесо баланса" pages={WHEEL_HELP} onClose={onClose} doneLabel="Пройти колесо" onDone={() => { onGuideSeen(); setTesting(true); }} />;

  const summary = step === WHEEL.length;
  const domain = WHEEL[step];
  const result = asResult(answers);
  const fullPct = wheelPercent(result);
  // Ответы стартуют на середине шкалы, поэтому средним по всем восьми сферам
  // шапка показывала около 50 % ещё до первого ответа и почти не двигалась от
  // ползунков. Пока колесо собирают, считаем по пройденным сферам и той, что
  // человек заполняет прямо сейчас.
  const pct = summary ? fullPct : wheelPercent(result, WHEEL.slice(0, step + 1).map((d) => d.key));
  const band = wheelBand(fullPct);
  const filled = summary ? WHEEL.length : step;
  const next = () => { if (step === WHEEL.length - 1) { success(); setStep(WHEEL.length); } else { select(); setStep((v) => v + 1); } };
  const setVal = (qi: number, v: number) => domain && setAnswers((s) => ({ ...s, [domain.key]: s[domain.key].map((x, i) => (i === qi ? v : x)) }));

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center" onClick={onClose}>
        <motion.div initial={{ y: 34 }} animate={{ y: 0 }} exit={{ y: 34, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} onClick={(e) => e.stopPropagation()} className="chunk max-h-[min(92dvh,calc(100dvh-var(--top-pad)))] w-full max-w-md overflow-y-auto bg-[#ffffff]">
          <div className="sticky top-0 z-[1] bg-[var(--purple)] px-5 py-4" style={{ borderBottom: "var(--bw-lg) solid var(--purple-edge)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name={summary ? "balance" : domain.icon} width={18} weight="bold" /></span>
                <div><p className="text-[10px] font-black uppercase tracking-[.12em]">{summary ? "Ваш результат" : `Сфера ${step + 1} из ${WHEEL.length}`}</p><p className="text-[14px] font-black leading-tight">{summary ? "Колесо собрано" : domain.label}</p></div>
              </div>
              <button onClick={() => { tap(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[14px] font-black stroke" aria-label="Закрыть">×</button>
            </div>
            {/* Прогресс-бар со статой */}
            <div className="mt-3 flex items-center gap-2.5">
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[#ffffff]" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
                <motion.div className="h-full rounded-full bg-[var(--ink)]" animate={{ width: `${(filled / WHEEL.length) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 24 }} />
              </div>
              <span className="tnum rounded-full bg-[#ffffff] px-2 py-0.5 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>{pct}%</span>
            </div>
          </div>

          <div className="p-5">
            {summary ? (
              <ResultView answers={answers} pct={pct} band={band} locked={locked} onSave={() => { success(); onClose(); }} onUnlock={onUnlock} />
            ) : (
              <>
                <motion.div key={domain.key} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
                  {domain.questions.map((q, qi) => (
                    <Question key={qi} q={q} value={answers[domain.key][qi]} onChange={(v) => setVal(qi, v)} />
                  ))}
                </motion.div>
                <div className="mt-5 flex gap-2">
                  {step > 0 && <button className="back-link" onClick={() => { tap(); setStep((v) => v - 1); }}>Назад</button>}
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

// Экран результата: круглое колесо (радар), сильные/слабые сферы и (для клиента без Хроника+) оплата.
function ResultView({ answers, pct, band, locked, onSave, onUnlock }: { answers: WheelAnswers; pct: number; band: ReturnType<typeof wheelBand>; locked: boolean; onSave: () => void; onUnlock?: () => void }) {
  const result: WheelResult = asResult(answers);
  const tone = band.tone === "green" ? "var(--green)" : band.tone === "amber" ? "var(--amber)" : "var(--salmon)";
  const edge = band.tone === "green" ? "var(--green-edge)" : band.tone === "amber" ? "var(--amber-edge)" : "var(--salmon-edge)";
  const per = WHEEL.map((d) => ({ d, v: domainScore(result, d.key) })).sort((a, b) => b.v - a.v);
  const strong = per.slice(0, 2);
  const focus = wheelFocus(result, 2).map((d) => ({ d, v: domainScore(result, d.key) }));

  return (
    <div className="space-y-4">
      {/* Круглое колесо баланса — как на странице терапии */}
      <div className="rounded-[16px] p-3 pt-4" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>
        <WheelChart result={result} size={252} />
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase" style={{ background: tone, border: `var(--bw) solid ${edge}` }}>{band.label}</span>
          <span className="tnum text-[13px] font-black">{pct}%</span>
        </div>
        <p className="mt-1.5 text-center text-[11px] font-semibold leading-snug text-[var(--muted)]">{band.hint}</p>
      </div>

      {/* Опора — где выше всего; фокус — где важно и при этом не хватает */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard title="Опора" items={strong} good />
        <StatCard title="С чего начать" items={focus} />
      </div>
      <p className="-mt-2 text-center text-[10px] font-semibold leading-snug text-[var(--muted-2)]">Слева — то, что держит. Справа — сферы, которые вам важны и при этом проседают.</p>

      {/* Результат уже сохранён автоматически; кнопка просто закрывает окно */}
      <Button className="w-full" onClick={onSave}>Готово — результат сохранён</Button>
      {locked && (
        <div className="rounded-[16px] p-4" style={{ background: "var(--purple-soft)", border: "var(--bw-lg) solid var(--purple-edge)" }}>
          <div className="flex items-center gap-2"><Icon name="therapy" width={18} weight="fill" /><p className="text-[13px] font-black">Больше в Хроника+</p></div>
          <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Детальный радар по 10 сферам, история и динамика от встречи к встрече — по подписке 390 ₽/мес.</p>
          <button onClick={() => { tap(); onUnlock?.(); }} className="mt-3 w-full rounded-[12px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white transition-transform active:scale-[0.98]">Открыть Хроника+ · 390 ₽/мес</button>
        </div>
      )}
      <p className="text-center text-[10px] font-semibold text-[var(--muted-2)]">Самооценка для разговора с терапевтом · не диагноз.</p>
    </div>
  );
}

function StatCard({ title, items, good }: { title: string; items: { d: (typeof WHEEL)[number]; v: number }[]; good?: boolean }) {
  return (
    <div className="rounded-[14px] bg-white p-3" style={{ border: `var(--bw) solid ${good ? "var(--green-edge)" : "var(--salmon-edge)"}` }}>
      <p className="text-[10px] font-black uppercase tracking-[.06em]" style={{ color: good ? "var(--green-edge)" : "var(--salmon-edge)" }}>{title}</p>
      <div className="mt-1.5 space-y-1">
        {items.map(({ d, v }) => (
          <div key={d.key} className="flex items-center justify-between gap-1"><span className="truncate text-[11px] font-bold">{d.short}</span><span className="tnum text-[11px] font-black text-[var(--muted)]">{v.toFixed(1)}</span></div>
        ))}
      </div>
    </div>
  );
}

// Вопрос со шкалой: под ползунком якоря, чтобы 0 и 10 читались одинаково у всех.
function Question({ q, value, onChange }: { q: WheelQuestion; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-bold leading-snug">{q.text}</p>
      <Scale value={value} onChange={onChange} />
      <div className="mt-0.5 flex items-center justify-between text-[9px] font-bold text-[var(--muted-2)]">
        <span>{q.low}</span>
        <span>{q.high}</span>
      </div>
    </div>
  );
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
