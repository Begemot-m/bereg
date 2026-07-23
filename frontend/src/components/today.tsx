"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { SectionTitle } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { tap } from "@/lib/haptics";

export type TodayItem = { icon: IconName; tone: string; title: string; sub: string; href?: string; onClick?: () => void };

const EASE = [0.16, 1, 0.3, 1] as const;

// «Сегодня» — короткий проактивный список: что стоит сделать сейчас.
export function TodayCard({ items }: { items: TodayItem[] }) {
  return (
    <section>
      <SectionTitle>Сегодня</SectionTitle>
      <div className="chunk overflow-hidden p-0">
        {items.length === 0 ? <EmptyToday /> : items.map((it, i) => <TodayRow key={i} item={it} index={i} />)}
      </div>
    </section>
  );
}

function TodayRow({ item, index }: { item: TodayItem; index: number }) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.04 + index * 0.06, duration: 0.32, ease: EASE }}
      className="group flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
      style={index > 0 ? { borderTop: "var(--bw) solid var(--edge-neutral)" } : undefined}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ background: `var(--${item.tone}-soft)`, border: `var(--bw) solid var(--${item.tone}-edge)` }}>
        <Icon name={item.icon} width={19} weight="bold" color={`var(--${item.tone}-edge)`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-black leading-tight">{item.title}</span>
        <span className="block text-[11.5px] font-semibold text-[var(--muted)]">{item.sub}</span>
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-black text-[var(--muted-2)] transition-transform duration-200 group-hover:translate-x-0.5 group-active:translate-x-0.5" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>›</span>
    </motion.div>
  );
  if (item.href) return <Link href={item.href} onClick={tap} className="block">{inner}</Link>;
  return <button onClick={() => { tap(); item.onClick?.(); }} className="block w-full text-left">{inner}</button>;
}

function EmptyToday() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <motion.span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }} animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
        <Icon name="check" width={19} weight="bold" color="var(--green-edge)" />
      </motion.span>
      <div>
        <p className="text-[14px] font-black leading-tight">На сегодня всё</p>
        <p className="text-[11.5px] font-semibold text-[var(--muted)]">Загляните вечером — отметьте, как прошёл день</p>
      </div>
    </div>
  );
}
