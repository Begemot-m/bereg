"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { HW_LABEL, updateHomework, type Homework, type HwStatus } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";

const EASE = [0.16, 1, 0.3, 1] as const;
const HW_FLOW: HwStatus[] = ["assigned", "doing", "done"];

function plural(n: number, one: string, few: string, many: string): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few;
  return many;
}

// Один блок вместо трёх: сколько прошло встреч, что с заданиями и сами задания.
export function WorkWithSpecialist({ sessionsDone, nextAt, homework, onChanged }: {
  sessionsDone: number;
  nextAt: string | null;
  homework: Homework[];
  onChanged: () => void;
}) {
  const done = homework.filter((h) => h.status === "done").length;
  const fresh = homework.filter((h) => h.status === "assigned").length;
  const progress = homework.length ? done / homework.length : 0;

  return (
    <section className="rounded-[22px] p-4" style={{ background: "var(--green-soft)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-micro">Работа со специалистом</p>
          <p className="t-title mt-1">{sessionsDone > 0 ? `${sessionsDone} ${plural(sessionsDone, "встреча", "встречи", "встреч")} позади` : "Встречи впереди"}</p>
        </div>
        {fresh > 0 && (
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black"
            style={{ background: "var(--amber)", color: "var(--amber-edge)" }}
          >
            <Alert /> {fresh} {plural(fresh, "новое", "новых", "новых")}
          </motion.span>
        )}
      </div>

      {homework.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="t-cap">Задания</span>
            <span className="tnum t-cap">{done} из {homework.length}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "#fff" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--green-edge)" }}
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.45, ease: EASE }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {homework.length === 0
          ? <p className="t-sub rounded-[16px] bg-white p-3">Заданий пока нет — терапевт пришлёт их после встречи.</p>
          : homework.map((hw) => <HomeworkCard key={hw.id} hw={hw} onChanged={onChanged} />)}
      </div>

      {nextAt && (
        <p className="t-cap mt-3 flex items-center gap-1.5">
          <Icon name="calendar" width={13} weight="bold" color="var(--green-edge)" />
          Следующая встреча: {new Date(nextAt).toLocaleString("ru-RU", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
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

  return (
    <motion.div layout className="rounded-[16px] bg-white p-3">
      <div className="flex items-start gap-2.5">
        {isNew
          ? <span className="mt-0.5 shrink-0"><Alert /></span>
          : <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: hw.status === "done" ? "var(--green)" : "var(--purple-soft)" }}>
              {hw.status === "done" && <Icon name="check" width={11} weight="bold" color="var(--green-edge)" />}
            </span>}
        <p className={`t-body flex-1 ${hw.status === "done" ? "opacity-55 line-through" : ""}`}>{hw.text}</p>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {HW_FLOW.map((status) => {
          const on = hw.status === status;
          return (
            <button
              key={status}
              onClick={() => { select(); save.mutate(status); }}
              className="flex-1 rounded-full py-1.5 text-[10.5px] font-black transition-colors"
              style={on
                ? { background: "var(--ink)", color: "#fff" }
                : { background: "var(--surface-2)", color: "var(--muted)" }}
            >
              {HW_LABEL[status]}
            </button>
          );
        })}
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
    <section className="rounded-[22px] p-4" style={{ background: "var(--amber-soft)" }}>
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
        className="t-body mt-3 w-full resize-none rounded-[16px] bg-white p-3.5 outline-none placeholder:font-normal placeholder:text-[var(--muted-2)]"
      />
      <p className="t-cap mt-2">Терапевт видит эту доску — писать в неё можно в любой момент.</p>
    </section>
  );
}
