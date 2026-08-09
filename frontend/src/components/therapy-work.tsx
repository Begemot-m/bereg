"use client";

import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Arrow } from "@/components/blocks";
import { HW_LABEL, updateHomework, type Homework, type HwStatus } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";

const dtf = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function WorkWithSpecialist({ homework }: {
  homework: Homework[];
}) {
  const active = homework.find((item) => item.status !== "done");
  // Новое задание видно ещё до открытия страницы — красной меткой.
  const fresh = homework.filter((item) => item.status === "assigned").length;

  return (
    <section data-tour="work" className="card-soft p-3">
      <Link href="/therapy/homework" onClick={tap} className="card-plain flex items-center gap-3 p-3">
        <span className="relative shrink-0">
          <span className="ico ico-accent h-11 w-11"><Icon name="book" width={20} weight="bold" /></span>
          {fresh > 0 && <span className="absolute -right-1 -top-1"><Alert /></span>}
        </span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="t-head">Задания</p>{fresh > 0 ? <NewChip count={fresh} /> : active && <span className="chip chip-strong">Активное</span>}</div><p className="t-cap mt-1 line-clamp-2">{active?.text ?? "Открыть страницу заданий"}</p></div>
        <Arrow />
      </Link>
    </section>
  );
}

export function ClientHomeworkDetail({ homework, onChanged }: { homework: Homework[]; onChanged: () => void }) {
  const active = homework.filter((item) => item.status !== "done");
  const done = homework.filter((item) => item.status === "done");
  const fresh = active.filter((item) => item.status === "assigned").length;
  return (
    <div className="space-y-4">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="t-head">Активные</h2>
          <span className="flex items-center gap-1.5">{fresh > 0 && <NewChip count={fresh} />}<span className="chip">{active.length}</span></span>
        </div>
        <div className="space-y-2">
          {active.length ? active.map((item) => <HomeworkCard key={item.id} hw={item} onChanged={onChanged} />) : <div className="card-soft p-4"><p className="t-head">Активных заданий нет</p><p className="t-cap mt-1">Новые задания от психолога появятся здесь.</p></div>}
        </div>
      </section>
      {done.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="t-head">История</h2><span className="chip">{done.length}</span></div>
          <div className="space-y-2">{done.map((item) => <HomeworkCard key={item.id} hw={item} onChanged={onChanged} />)}</div>
        </section>
      )}
    </div>
  );
}

// Красная метка нового задания: и кружок с «!», и подпись рядом с заголовком.
function Alert() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black" style={{ background: "var(--danger)", color: "#fff" }}>!</span>
  );
}

function NewChip({ count }: { count?: number }) {
  return (
    <span className="chip inline-flex items-center gap-1" style={{ background: "var(--danger)", color: "#fff" }}>
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/25 text-[9px] font-black">!</span>
      {count && count > 1 ? `Новые · ${count}` : "Новое"}
    </span>
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
      className="card p-3"
      style={isNew ? { borderColor: "var(--danger)" } : undefined}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full" style={{ background: isNew ? "var(--danger)" : "var(--purple)" }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">{isNew && <Alert />}<p className="t-head">Домашнее задание</p></div>
            {isNew ? <NewChip /> : <span className="chip" style={{ background: "var(--purple-soft)" }}>{HW_LABEL[hw.status]}</span>}
          </div>
          <p className={`t-body mt-1 leading-snug ${isDone ? "line-through text-[var(--muted)]" : "text-[var(--ink)]"}`}>{hw.text}</p>
          <p className="t-cap mt-2">{dtf.format(new Date(hw.sentAt))}</p>
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
        placeholder="Сюда можно писать любые заметки: мысли, вопросы, ситуации недели — всё, что хочется вынести на встречу."
        className="t-body mt-3 w-full resize-none rounded-[14px] bg-white p-3.5 outline-none placeholder:font-normal placeholder:text-[var(--muted-2)]"
      />
      <p className="t-cap mt-2">Сюда можно писать любые заметки — терапевт увидит их в любой момент, не только на сессии.</p>
    </section>
  );
}

// Та же доска глазами терапевта — в карточке клиента, только чтение.
export function TherapistBoardView({ value, name }: { value: string; name: string }) {
  const first = name.split(" ")[0];
  return (
    <section className="rounded-[20px] p-4" style={{ background: "var(--amber-soft)" }}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="ico ico-white h-10 w-10 shrink-0"><Icon name="chalkboard" width={20} weight="bold" color="var(--amber-edge)" /></span>
        <div className="min-w-0">
          <p className="t-micro">Доска клиента</p>
          <p className="t-head mt-0.5">Что важно не забыть сказать</p>
        </div>
      </div>
      {value.trim() ? (
        <p className="t-body mt-3 whitespace-pre-wrap rounded-[14px] bg-white p-3.5">{value}</p>
      ) : (
        <p className="t-cap mt-3 rounded-[14px] bg-white/70 p-3.5">Пока пусто. {first} может писать сюда любые заметки между встречами — вы увидите их здесь в любой момент.</p>
      )}
    </section>
  );
}
