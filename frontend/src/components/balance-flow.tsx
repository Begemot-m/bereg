"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { WHO5_ITEMS, WHO5_OPTIONS, who5Band } from "@/lib/therapy";
import { select, success, tap } from "@/lib/haptics";

const HelpFrame = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[128px] flex-col justify-center gap-2 rounded-[16px] p-3" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>{children}</div>
);

export const WHO5_HELP: HelpPage[] = [
  {
    title: "Индекс благополучия WHO-5",
    text: "Короткая шкала Всемирной организации здравоохранения из пяти пунктов. Пять ответов складываются в понятный процент — от 0 до 100.",
    illo: (
      <HelpFrame>
        <div className="flex items-center justify-between rounded-[13px] bg-white p-3" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
          <div><p className="text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Благополучие</p><p className="font-tight text-[26px] font-black leading-none">72%</p><p className="text-[10px] font-black uppercase" style={{ color: "var(--green-edge)" }}>нормальное</p></div>
          <span className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[var(--purple)]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name="balance" width={24} weight="bold" /></span>
        </div>
      </HelpFrame>
    ),
  },
  {
    title: "Отвечайте про две недели",
    text: "Для каждого утверждения выберите, как часто это было с вами за последние 14 дней. Правильных ответов нет — важна первая честная оценка.",
    illo: (
      <HelpFrame>
        <p className="text-[11px] font-black">За две недели я чувствовал(а) себя спокойно</p>
        {["Всё время", "Больше половины времени", "Изредка"].map((t, i) => (
          <div key={t} className="rounded-[10px] px-3 py-1.5 text-[10px] font-bold" style={i === 0 ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", border: "var(--bw) solid var(--purple-edge)" }}>{t}</div>
        ))}
      </HelpFrame>
    ),
  },
  {
    title: "Результат виден терапевту",
    text: "Оценка сохранится здесь, а ваш терапевт увидит её в вашей карточке. Пройти шкалу заново можно в любой момент — так видно динамику.",
    illo: (
      <HelpFrame>
        {[["Настроение", 80], ["Спокойствие", 60], ["Энергия", 60], ["Сон и отдых", 40]].map(([label, w]) => (
          <div key={label as string} className="flex items-center gap-2">
            <span className="w-16 text-[9px] font-bold text-[var(--muted)]">{label}</span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><div className="h-full rounded-full bg-[var(--purple)]" style={{ width: `${w}%` }} /></div>
          </div>
        ))}
      </HelpFrame>
    ),
  },
];

export function Who5Flow({ guide, onClose, onGuideSeen, onSave }: { guide: boolean; onClose: () => void; onGuideSeen: () => void; onSave: (answers: number[]) => void }) {
  const [testing, setTesting] = useState(!guide);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(WHO5_ITEMS.length).fill(null));
  if (!testing) return <HelpDeck title="Шкала благополучия" pages={WHO5_HELP} onClose={onClose} doneLabel="Пройти шкалу" onDone={() => { onGuideSeen(); setTesting(true); }} />;

  const current = answers[step];
  const last = step === WHO5_ITEMS.length - 1;
  const filled = answers.filter((a) => a !== null).length;
  const choose = (value: number) => { select(); setAnswers((state) => state.map((a, i) => (i === step ? value : a))); };
  const next = () => {
    if (current === null) return;
    if (last) { success(); onSave(answers.map((a) => a ?? 0)); onClose(); }
    else { select(); setStep((v) => v + 1); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center" onClick={onClose}>
        <motion.div initial={{ y: 34 }} animate={{ y: 0 }} exit={{ y: 34, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} onClick={(event) => event.stopPropagation()} className="chunk w-full max-w-md overflow-hidden bg-[#fffdf7]">
          <div className="flex items-center justify-between bg-[var(--purple)] px-5 py-4" style={{ borderBottom: "var(--bw-lg) solid var(--purple-edge)" }}>
            <div><p className="text-[10px] font-black uppercase tracking-[.12em]">Шкала благополучия · WHO-5</p><p className="mt-0.5 text-[13px] font-bold">Пункт {step + 1} из {WHO5_ITEMS.length}</p></div>
            <button onClick={() => { tap(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[14px] font-black stroke" aria-label="Закрыть">×</button>
          </div>
          <div className="p-5">
            <div className="mb-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${WHO5_ITEMS.length}, 1fr)` }}>{WHO5_ITEMS.map((_, index) => <span key={index} className="h-2 rounded-full" style={{ background: index <= step ? "var(--purple)" : "#fff", border: "var(--bw) solid var(--purple-edge)" }} />)}</div>
            <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">За последние две недели</p>
            <h3 className="font-tight mt-2 min-h-[64px] text-[20px] font-black leading-[1.12]">{WHO5_ITEMS[step]}</h3>
            <div className="mt-4 space-y-1.5">
              {WHO5_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => choose(opt.value)} className="flex w-full items-center gap-3 rounded-[13px] px-3.5 py-2.5 text-left transition-transform active:scale-[0.99]" style={current === opt.value ? { background: "var(--ink)", color: "#fff", border: "var(--bw) solid var(--ink)" } : { background: "#fff", border: "var(--bw) solid var(--purple-edge)" }}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black" style={current === opt.value ? { background: "#fff", color: "var(--ink)" } : { background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>{opt.value}</span>
                  <span className="text-[13px] font-bold">{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              {step > 0 && <Button variant="soft" onClick={() => { tap(); setStep((v) => v - 1); }}>Назад</Button>}
              <Button className="flex-1" disabled={current === null} onClick={next}>{last ? `Готово · ${who5Band(answers.map((a) => a ?? 0).reduce((s, v) => s + v, 0) * 4).label}` : "Дальше"}</Button>
            </div>
            <p className="mt-3 text-center text-[10px] font-semibold text-[var(--muted-2)]">Заполнено {filled} из {WHO5_ITEMS.length} · самооценка, не диагноз.</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
