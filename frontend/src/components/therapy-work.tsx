"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { updateHomework, type Homework, type HwStatus } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";

function plural(n: number, one: string, few: string, many: string): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few;
  return many;
}

// Один блок вместо трёх: сколько прошло встреч, что с заданиями и сами задания.
export function WorkWithSpecialist({ sessionsDone, homework, onChanged }: {
  sessionsDone: number;
  homework: Homework[];
  onChanged: () => void;
}) {
  const done = homework.filter((h) => h.status === "done").length;
  const fresh = homework.filter((h) => h.status === "assigned").length;
  const active = homework.filter((h) => h.status !== "done");
  const [historyOpen, setHistoryOpen] = useState(false);
  const visible = active.length ? active : homework.slice(-1);

  return (
    <section data-tour="work" className="rounded-[20px] p-4" style={{ background: "var(--green-soft)" }}>
      <h2 className="t-title text-[var(--ink)]">Работа со специалистом</h2>
      <div className="mt-2 grid grid-cols-[112px_1fr] gap-3 rounded-[16px] bg-white p-3">
        <div><p className="tnum font-tight text-[30px] font-black leading-none">{sessionsDone}</p><p className="t-cap mt-1">{plural(sessionsDone, "встреча", "встречи", "встреч")}</p></div>
        <div><p className="t-cap">Динамика встреч</p><div className="mt-2 flex h-10 items-end gap-1.5">{[.35,.55,.42,.72,.62,1].map((v, i) => <motion.span key={i} className="flex-1 rounded-t-[5px] bg-[var(--purple-edge)]" initial={{ height: 4 }} animate={{ height: `${Math.max(12, v * Math.min(40, 12 + sessionsDone * 4))}px` }} transition={{ delay: i * .04 }} />)}</div></div>
      </div>

      <div className="mt-4 flex items-center justify-between"><h3 className="t-head text-[var(--ink)]">Задания</h3>{fresh > 0 && <span className="t-cap font-black text-[var(--purple-edge)]">{fresh} новых</span>}</div>
      <div className="mt-2 space-y-2">
        {homework.length === 0
          ? <p className="t-sub rounded-[14px] bg-white p-3">Заданий пока нет — терапевт пришлёт их после встречи.</p>
          : visible.map((hw) => <HomeworkCard key={hw.id} hw={hw} onChanged={onChanged} />)}
      </div>

      {homework.length > visible.length && <button onClick={() => { tap(); setHistoryOpen((v) => !v); }} className="mt-2 inline-flex min-h-9 items-center text-[12px] font-black text-[var(--purple-edge)]">{historyOpen ? "Скрыть историю заданий" : `История заданий · ${done}`}</button>}
      <AnimatePresence initial={false}>{historyOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 space-y-2 overflow-hidden">{homework.filter((hw) => !visible.some((item) => item.id === hw.id)).map((hw) => <HomeworkCard key={hw.id} hw={hw} onChanged={onChanged} />)}</motion.div>}</AnimatePresence>

    </section>
  );
}

function Alert() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black" style={{ background: "var(--amber-edge)", color: "#fff" }}>!</span>
  );
}

function HomeworkCard({ hw, onChanged }: { hw: Homework; onChanged: () => void }) {
  const [celebrate, setCelebrate] = useState(false);
  const save = useMutation({
    mutationFn: (status: HwStatus) => updateHomework(hw.id, { status }),
    onSuccess: (_data, status) => {
      if (status === "done") { success(); setCelebrate(true); setTimeout(() => setCelebrate(false), 2000); }
      onChanged();
    },
  });
  const isNew = hw.status === "assigned";
  const isDone = hw.status === "done";

  return (
    <motion.div
      layout
      className="rounded-[14px] bg-white p-3"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--purple-edge)]">
          <Icon name={isDone ? "check" : "note"} width={16} weight="bold" color="#fff" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">{isNew && <Alert />}<p className="t-micro text-[var(--purple-edge)]">{isDone ? "Выполнено" : isNew ? "Новое задание" : "В работе"}</p></div>
          <p className={`mt-1 text-[15px] font-bold leading-snug ${isDone ? "line-through text-[var(--muted)]" : "text-[var(--ink)]"}`}>{hw.text}</p>
        </div>
      </div>
      <div className="mt-3 grid w-full grid-cols-2 rounded-full bg-[var(--surface-2)] p-0.5 text-[10px] font-black">
        <button onClick={() => { select(); save.mutate("doing"); }} className="rounded-full px-3 py-1.5" style={!isDone ? { background: "var(--purple-edge)", color: "#fff" } : { color: "var(--muted)" }}>Выполняется</button>
        <button onClick={() => { select(); save.mutate("done"); }} className="rounded-full px-3 py-1.5" style={isDone ? { background: "var(--green-edge)", color: "#fff" } : { color: "var(--muted)" }}>Выполнено</button>
      </div>
      <AnimatePresence>
        {celebrate && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="t-cap mt-2 flex items-center gap-1" style={{ color: "var(--green-edge)" }}
          >
            <Icon name="check" width={13} weight="bold" color="var(--green-edge)" /> Задание закрыто — так держать
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Свободные заметки, которые видит терапевт. Сохраняются сами, с задержкой.
export function TherapistBoard({ value, onSave }: { value: string; onSave: (text: string) => void }) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  const first = useRef(true);

  useEffect(() => { setText(value); }, [value]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (text === value) return;
    const timer = window.setTimeout(() => { onSave(text); setSaved(true); window.setTimeout(() => setSaved(false), 1600); }, 700);
    return () => window.clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section data-tour="board" className="rounded-[20px] p-4" style={{ background: "var(--amber-soft)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="t-micro">Доска для терапевта</p>
          <p className="t-head mt-0.5">Что важно не забыть сказать</p>
        </div>
        <AnimatePresence>
          {saved && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="t-cap" style={{ color: "var(--amber-edge)" }}>
              сохранено
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={tap}
        rows={4}
        maxLength={4000}
        placeholder="Мысли, вопросы, ситуации недели — всё, что хочется вынести на встречу."
        className="t-body mt-3 w-full resize-none rounded-[14px] bg-white p-3.5 outline-none placeholder:font-normal placeholder:text-[var(--muted-2)]"
      />
      <p className="t-cap mt-2">Терапевт видит эту доску — писать в неё можно в любой момент.</p>
    </section>
  );
}
