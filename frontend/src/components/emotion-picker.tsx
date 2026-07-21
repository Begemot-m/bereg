"use client";

import { motion } from "motion/react";

import { EMOTION_FAMILIES } from "@/lib/emotions";
import { select } from "@/lib/haptics";

// Выбор состояний по всем эмоциям — семьями, с мультивыбором.
export function EmotionPicker({ value, onChange, max = 6 }: { value: string[]; onChange: (next: string[]) => void; max?: number }) {
  const toggle = (name: string) => {
    select();
    if (value.includes(name)) onChange(value.filter((item) => item !== name));
    else if (value.length < max) onChange([...value, name]);
  };
  return (
    <div className="space-y-3">
      {EMOTION_FAMILIES.map((family) => (
        <div key={family.key}>
          <p className="mb-1.5 text-[9px] font-black uppercase tracking-[.1em] text-[var(--muted)]">{family.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {family.items.map((name) => {
              const on = value.includes(name);
              return (
                <motion.button
                  key={name}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => toggle(name)}
                  aria-pressed={on}
                  className="rounded-full px-3 py-1.5 text-[12px] font-black transition-colors duration-150"
                  style={{
                    background: on ? `var(--${family.tone})` : "#fff",
                    border: `var(--bw) solid var(--${on ? `${family.tone}-edge` : "edge-neutral"})`,
                    color: on ? "var(--ink)" : "var(--muted)",
                  }}
                >
                  {name}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[10px] font-semibold text-[var(--muted-2)]">Можно отметить до {max} состояний — это точнее, чем одна оценка.</p>
    </div>
  );
}
