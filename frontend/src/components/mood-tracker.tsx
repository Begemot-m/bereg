"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import type { Mood } from "@/lib/clients";
import { success, tap } from "@/lib/haptics";
import { ANIMALS, animalName, mascotSrc, MOOD_LABEL, useAnimal } from "@/lib/mascots";

/* eslint-disable @next/next/no-img-element */

// Пять кнопок-настроений в виде маскота с разными эмоциями + смена питомца.
export function MoodFaces({ todayMood, onMood }: { todayMood?: number; onMood: (m: number) => void }) {
  const [animal, setAnimal] = useAnimal();
  const [pick, setPick] = useState(false);

  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => {
          const on = todayMood === v;
          return (
            <motion.button key={v} onClick={() => { success(); onMood(v); }} whileTap={{ scale: 0.9 }} animate={on ? { scale: [1, 1.16, 1] } : { scale: 1 }} transition={{ duration: 0.4 }}
              className="flex aspect-square items-center justify-center rounded-[15px]" style={{ background: on ? "var(--ink)" : "#fff", border: `var(--bw) solid ${on ? "var(--ink)" : "var(--edge-neutral)"}` }} aria-label={MOOD_LABEL[v]}>
              <img src={mascotSrc(animal, v)} alt={MOOD_LABEL[v]} className="h-full w-full object-contain p-0.5" style={{ filter: on ? "none" : "saturate(0.92)" }} />
            </motion.button>
          );
        })}
      </div>
      <button onClick={() => { tap(); setPick(true); }} className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
        <span className="text-[13px]">🐾</span> Питомец: {animalName(animal)} · сменить
      </button>
      <AnimatePresence>{pick && <AnimalPicker current={animal} onPick={(a) => { setAnimal(a); setPick(false); }} onClose={() => setPick(false)} />}</AnimatePresence>
    </div>
  );
}

function AnimalPicker({ current, onPick, onClose }: { current: string; onPick: (a: string) => void; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(32,28,24,.42)] p-3 @md:items-center" onClick={onClose}>
      <motion.div initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }} onClick={(e) => e.stopPropagation()} className="chunk w-full max-w-md p-4" style={{ background: "var(--surface)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-tight text-[17px] font-black">Выберите питомца</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full stroke text-[15px] font-bold" style={{ background: "#fff" }}>✕</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {ANIMALS.map((a) => {
            const on = a.key === current;
            return (
              <button key={a.key} onClick={() => { success(); onPick(a.key); }} className="flex flex-col items-center gap-1 rounded-[15px] p-2" style={{ background: on ? "var(--head-soft)" : "#fff", border: `var(--bw) solid ${on ? "var(--edge)" : "var(--edge-neutral)"}` }}>
                <img src={mascotSrc(a.key, 5)} alt={a.name} className="h-12 w-12 object-contain" />
                <span className="text-[10px] font-black">{a.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[11px] font-semibold text-[var(--muted-2)]">Маскот покажет ваше настроение — от «тяжело» до «отлично».</p>
      </motion.div>
    </motion.div>
  );
}

// Тренд за неделю: маленький маскот дня в его настроении.
export function MoodTrend({ moods }: { moods: Mood[] }) {
  const [animal] = useAnimal();
  const day = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
  if (moods.length === 0) return null;
  return (
    <div className="mt-3 flex items-end justify-between gap-1">
      {moods.map((m, i) => (
        <motion.div key={`${m.date}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex flex-1 flex-col items-center gap-0.5">
          <img src={mascotSrc(animal, m.mood)} alt="" className="h-7 w-7 object-contain" style={{ opacity: 0.5 + m.mood * 0.1 }} />
          <span className="text-[8px] font-black uppercase text-[var(--muted)]">{day.format(new Date(m.date)).slice(0, 2)}</span>
        </motion.div>
      ))}
    </div>
  );
}
