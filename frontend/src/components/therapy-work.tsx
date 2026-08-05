"use client";

import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Arrow } from "@/components/blocks";
import { updateHomework, type Homework, type HwStatus } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";

export function WorkWithSpecialist({ homework }: {
  homework: Homework[];
}) {
  const active = homework.find((item) => item.status !== "done");

  return (
    <section data-tour="work" className="card-soft p-3">
      <Link href="/therapy/homework" onClick={tap} className="card-plain flex items-center gap-3 p-3">
        <span className="ico ico-accent h-11 w-11 shrink-0"><Icon name="book" width={20} weight="bold" /></span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="t-head">Задания</p>{active && <span className="chip chip-strong">Активное</span>}</div><p className="t-cap mt-1 line-clamp-2">{active?.text ?? "Открыть страницу заданий"}</p></div>
        <Arrow />
      </Link>
    </section>
  );
}

export function ClientHomeworkDetail({ homework, onChanged }: { homework: Homework[]; onChanged: () => void }) {
  const active = homework.filter((item) => item.status !== "done");
  const done = homework.filter((item) => item.status === "done");
  return <div className="space-y-4"><section><div className="mb-3 flex items-center justify-between"><h2 className="t-head">Активные задания</h2>{active.length > 0 && <span className="chip chip-strong">{active.length}</span>}</div><div className="space-y-2">{active.length ? active.map((item) => <HomeworkCard key={item.id} hw={item} onChanged={onChanged} />) : <div className="card-soft p-4"><p className="t-head">Активных заданий нет</p><p className="t-cap mt-1">Новые задания от психолога появятся здесь.</p></div>}</div></section>{done.length > 0 && <section><h2 className="t-head mb-3">История</h2><div className="space-y-2">{done.map((item) => <HomeworkCard key={item.id} hw={item} onChanged={onChanged} />)}</div></section>}</div>;
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
          <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1.5">{isNew && <Alert />}<p className="t-head">Домашнее задание</p></div><span className="t-micro text-[var(--purple-edge)]">{isDone ? "Выполнено" : isNew ? "Новое" : "В работе"}</span></div>
          <p className={`t-body mt-1 leading-snug ${isDone ? "line-through text-[var(--muted)]" : "text-[var(--ink)]"}`}>{hw.text}</p>
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="ico ico-white h-10 w-10 shrink-0"><Icon name="chalkboard" width={20} weight="bold" color="var(--amber-edge)" /></span>
          <div className="min-w-0">
            <p className="t-micro">Доска для терапевта</p>
            <p className="t-head mt-0.5">Что важно не забыть сказать</p>
          </div>
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
      <p className="t-cap mt-2">Терапевт увидит эту доску в любой момент.</p>
    </section>
  );
}
