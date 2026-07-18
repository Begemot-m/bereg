"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Button } from "@/components/ui";
import { BALANCE_KEYS, BALANCE_META, type BalanceScores } from "@/lib/therapy";
import { select, success, tap } from "@/lib/haptics";

export const BALANCE_HELP: HelpPage[] = [
  { title: "Посмотрите на жизнь целиком", text: "Колесо собирает восемь сфер в одну понятную карту. Это самооценка, а не диагноз.", image: "/balance-guide-overview.png", imageAlt: "Экран терапии с колесом баланса" },
  { title: "Отвечайте про последние две недели", text: "Для каждой сферы выберите число от 0 до 10. Здесь нет правильных ответов — важнее ваша первая честная оценка.", image: "/balance-guide-test.png", imageAlt: "Один из вопросов короткого теста" },
  { title: "Обсудите карту на встрече", text: "Результат сохранится здесь, а терапевт увидит его в карточке клиента. Пройти тест заново можно в любой момент.", image: "/balance-guide-result.png", imageAlt: "Результат колеса баланса" },
];

export function BalanceFlow({ guide, onClose, onGuideSeen, onSave }: { guide: boolean; onClose: () => void; onGuideSeen: () => void; onSave: (scores: BalanceScores) => void }) {
  const [testing, setTesting] = useState(!guide);
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Partial<BalanceScores>>({});
  if (!testing) return <HelpDeck title="Колесо баланса" pages={BALANCE_HELP} onClose={onClose} doneLabel="Пройти короткий тест" onDone={() => { onGuideSeen(); setTesting(true); }} />;

  const key = BALANCE_KEYS[step];
  const current = scores[key];
  const last = step === BALANCE_KEYS.length - 1;
  const choose = (value: number) => { select(); setScores((state) => ({ ...state, [key]: value })); };
  const next = () => {
    if (current === undefined) return;
    if (last) { success(); onSave(scores as BalanceScores); onClose(); }
    else { select(); setStep((value) => value + 1); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center" onClick={onClose}>
        <motion.div initial={{ y: 34 }} animate={{ y: 0 }} exit={{ y: 34, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} onClick={(event) => event.stopPropagation()} className="chunk w-full max-w-md overflow-hidden bg-[#fffdf7]">
          <div className="flex items-center justify-between bg-[var(--purple)] px-5 py-4" style={{ borderBottom: "var(--bw-lg) solid var(--purple-edge)" }}>
            <div><p className="text-[10px] font-black uppercase tracking-[.12em]">Колесо баланса</p><p className="mt-0.5 text-[13px] font-bold">Вопрос {step + 1} из {BALANCE_KEYS.length}</p></div>
            <button onClick={() => { tap(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[14px] font-black stroke" aria-label="Закрыть">×</button>
          </div>
          <div className="p-5">
            <div className="mb-5 grid grid-cols-8 gap-1">{BALANCE_KEYS.map((_, index) => <span key={index} className="h-2 rounded-full border border-[rgba(32,28,24,.4)]" style={{ background: index <= step ? "var(--purple)" : "#fff" }} />)}</div>
            <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Последние две недели</p>
            <h3 className="font-tight mt-2 min-h-[78px] text-[23px] font-black leading-[1.08]">{BALANCE_META[key].question}</h3>
            <div className="mt-6 grid grid-cols-6 gap-2">
              {Array.from({ length: 11 }, (_, value) => <button key={value} onClick={() => choose(value)} className="flex aspect-square items-center justify-center rounded-[12px] text-[14px] font-black stroke transition-transform active:scale-95" style={current === value ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff" }}>{value}</button>)}
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-bold text-[var(--muted)]"><span>совсем не устраивает</span><span>полностью устраивает</span></div>
            <div className="mt-6 flex gap-2">
              {step > 0 && <Button variant="soft" onClick={() => setStep((value) => value - 1)}>Назад</Button>}
              <Button className="flex-1" disabled={current === undefined} onClick={next}>{last ? "Сохранить результат" : "Следующий вопрос"}</Button>
            </div>
            <p className="mt-3 text-center text-[10px] font-semibold text-[var(--muted-2)]">Самооценка помогает разговору с терапевтом и не заменяет диагностику.</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
