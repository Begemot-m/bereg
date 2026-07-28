"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Arrow } from "@/components/blocks";
import { buildDays, goodFor, plural, streak, todayState, DAILY_TOTAL } from "@/lib/daily";
import type { Mood } from "@/lib/clients";
import type { GoodNote } from "@/lib/therapy";
import { success, tap } from "@/lib/haptics";

const EASE = [0.16, 1, 0.3, 1] as const;
const WEEKDAY = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });

export function DailyCard({ moods, notes, onOpenMood, onSaveGood }: {
  moods: Mood[];
  notes: GoodNote[];
  onOpenMood: () => void;
  onSaveGood: (text: string) => void;
}) {
  const today = todayState(moods, notes);
  const week = buildDays(moods, notes, 7);
  const series = streak(moods, notes);
  const doneCount = (today.mood ? 1 : 0) + (today.good ? 1 : 0);
  const [sheet, setSheet] = useState(false);

  const todayMood = [...moods].reverse().find((m) => new Date(m.date).toDateString() === new Date().toDateString());
  const moodHint = today.mood ? (todayMood?.emotions?.slice(0, 2).join(", ") || "отмечено") : "полминуты на себя";
  const goodText = goodFor(notes);

  return (
    <section className="rounded-[20px] bg-white p-4" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-black leading-tight">
            {doneCount === DAILY_TOTAL ? "День закрыт" : doneCount === 0 ? "Две опоры на сегодня" : "Осталось одно"}
          </p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-[var(--muted)]">
            {doneCount === DAILY_TOTAL ? "Обе отметки на месте" : `${doneCount} из ${DAILY_TOTAL} · займёт минуту`}
          </p>
        </div>
        {series.days > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: "var(--amber-soft)", color: "var(--amber-edge)" }}>
            <Icon name="spark" width={12} weight="fill" color="var(--amber-edge)" />
            {series.days} {plural(series.days, "день", "дня", "дней")}
          </span>
        )}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--green)" }}
          initial={false}
          animate={{ width: `${(doneCount / DAILY_TOTAL) * 100}%` }}
          transition={{ duration: 0.45, ease: EASE }}
        />
      </div>

      <div className="mt-3 space-y-2">
        <DailyRow icon="mood" title="Как вы сегодня" hint={moodHint} done={today.mood} onClick={() => { tap(); onOpenMood(); }} />
        <DailyRow icon="spark" title="Что хорошего" hint={today.good ? goodText : "одна строка про день"} done={today.good} onClick={() => { tap(); setSheet(true); }} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        {week.map((day, i) => {
          const isToday = i === week.length - 1;
          const half = !day.done && (day.mood || day.good);
          return (
            <span key={day.key} className="flex flex-col items-center gap-1.5">
              <span className="text-[9.5px] font-black uppercase text-[var(--muted-2)]">{WEEKDAY.format(day.date).replace(".", "")}</span>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{
                  background: day.done ? "var(--green)" : half ? "var(--amber-soft)" : "var(--surface-2)",
                  outline: isToday ? "2px solid var(--purple-edge)" : undefined,
                  outlineOffset: "2px",
                }}
              >
                {day.done && <Icon name="check" width={13} weight="bold" color="var(--green-edge)" />}
              </span>
            </span>
          );
        })}
      </div>

      {series.forgiven && (
        <p className="mt-3 text-[10.5px] font-semibold text-[var(--muted-2)]">Один пропущенный день серию не рвёт — это нормально.</p>
      )}

      <GoodSheet open={sheet} initial={goodText} onClose={() => setSheet(false)} onSave={(text) => { onSaveGood(text); setSheet(false); }} />
    </section>
  );
}

function DailyRow({ icon, title, hint, done, onClick }: { icon: IconName; title: string; hint: string; done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[14px] p-3 text-left transition-transform active:scale-[0.99]"
      style={{ background: done ? "var(--green-soft)" : "var(--surface-2)" }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: done ? "var(--green)" : "#fff" }}>
        <Icon name={done ? "check" : icon} width={17} weight="bold" color={done ? "var(--green-edge)" : "var(--purple-edge)"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-black leading-tight">{title}</span>
        <span className="block truncate text-[11.5px] font-semibold text-[var(--muted)]">{hint}</span>
      </span>
      <Arrow />
    </button>
  );
}

const PROMPTS = [
  "что вас сегодня порадовало, даже мелочь",
  "за что вы себе благодарны сегодня",
  "что получилось лучше, чем вы ждали",
  "кто или что стало сегодня опорой",
];

function GoodSheet({ open, initial, onClose, onSave }: { open: boolean; initial: string; onClose: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState(initial);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  useEffect(() => {
    if (!open) return;
    setText(initial);
    setPrompt(PROMPTS[new Date().getDate() % PROMPTS.length]);
  }, [open, initial]);

  const save = () => {
    const value = text.trim();
    if (!value) return;
    success();
    onSave(value);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.button
            aria-label="Закрыть"
            onClick={onClose}
            className="absolute inset-0 bg-[rgba(32,28,24,.45)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative w-full max-w-md rounded-t-[25px] bg-white px-5 pb-[calc(var(--safe-bottom)+20px)] pt-5"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.34, ease: EASE }}
          >
            <span className="mx-auto mb-4 block h-1 w-10 rounded-full" style={{ background: "var(--surface-2)" }} />
            <p className="text-[19px] font-black leading-tight">Что хорошего принёс день?</p>
            <p className="mt-1.5 text-[12.5px] font-semibold text-[var(--muted)]">Подсказка: {prompt}. Одной строки достаточно.</p>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={240}
              placeholder="Например: дошла до конца дня без самокритики"
              className="mt-3 w-full resize-none rounded-[14px] p-3.5 text-[14px] font-semibold outline-none placeholder:font-normal placeholder:text-[var(--muted-2)]"
              style={{ background: "var(--surface-2)" }}
            />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={onClose} className="rounded-full px-4 py-3 text-[13px] font-black text-[var(--muted)]">Позже</button>
              <button
                onClick={save}
                disabled={!text.trim()}
                className="flex-1 rounded-full py-3 text-[14px] font-black text-white transition-transform active:scale-[0.98] disabled:opacity-40"
                style={{ background: "var(--ink)" }}
              >
                Записать
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
