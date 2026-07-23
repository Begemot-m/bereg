"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import type { MyBooking } from "@/lib/clients";
import { success, tap } from "@/lib/haptics";

const OPTS: { key: string; label: string; tone: string; icon: IconName }[] = [
  { key: "good", label: "Помогла", tone: "green", icon: "heart" },
  { key: "ok", label: "Нормально", tone: "amber", icon: "mood" },
  { key: "hard", label: "Тяжело", tone: "salmon", icon: "pulse" },
];
const fkey = (id: number) => `bereg:sf:${id}`;

// Пост-сессия: мягкий чек-ин после состоявшейся встречи. Появляется один раз.
export function SessionCheckin({ bookings }: { bookings: MyBooking[] }) {
  const [target, setTarget] = useState<MyBooking | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const now = Date.now();
    const past = bookings.filter((b) => new Date(b.startsAt).getTime() < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    setTarget(past.find((b) => !localStorage.getItem(fkey(b.id))) ?? null);
  }, [bookings]);

  if (!target) return null;
  const answer = (v: string) => { success(); localStorage.setItem(fkey(target.id), v); setDone(true); };

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-3 rounded-[22px] bg-white p-4" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--green-soft)]" style={{ border: "var(--bw) solid var(--green-edge)" }}><Icon name="check" width={18} weight="bold" color="var(--green-edge)" /></span>
            <p className="text-[13px] font-black">Спасибо — это помогает вашей терапии</p>
          </motion.div>
        ) : (
          <motion.div key="q" exit={{ opacity: 0 }}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--purple-soft)]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><Icon name="therapy" width={18} weight="bold" /></span>
              <div><p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">После встречи</p><p className="text-[14px] font-black leading-tight">Как прошла встреча с {target.psyName.split(" ")[0]}?</p></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {OPTS.map((o) => (
                <button key={o.key} onClick={() => { tap(); answer(o.key); }} className="flex flex-col items-center gap-1.5 rounded-[14px] py-2.5 transition-transform active:scale-[0.96]" style={{ background: `var(--${o.tone}-soft)`, border: `var(--bw) solid var(--${o.tone}-edge)` }}>
                  <Icon name={o.icon} width={20} weight="bold" color={`var(--${o.tone}-edge)`} />
                  <span className="text-[11px] font-black">{o.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
