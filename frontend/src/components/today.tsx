"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { Arrow, SectionTitle } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { tap } from "@/lib/haptics";

// tone — если у задания есть собственный цвет (колесо баланса — лавандовое).
export type TodayItem = { icon: IconName; title: string; sub: string; href?: string; onClick?: () => void; tone?: string };

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
      className={`group flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99] ${index > 0 ? "line-top" : ""}`}
    >
      <span className="ico h-10 w-10 shrink-0" style={item.tone ? { background: `var(--${item.tone}-soft)` } : undefined}>
        <Icon name={item.icon} width={19} weight="bold" color={item.tone ? `var(--${item.tone}-edge)` : "var(--edge)"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-head block">{item.title}</span>
        <span className="t-sub block">{item.sub}</span>
      </span>
      <Arrow />
    </motion.div>
  );
  if (item.href) return <Link href={item.href} onClick={tap} className="block">{inner}</Link>;
  return <button onClick={() => { tap(); item.onClick?.(); }} className="block w-full text-left">{inner}</button>;
}

function EmptyToday() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className="ico h-10 w-10 shrink-0">
        <Icon name="check" width={19} weight="bold" color="var(--edge)" />
      </span>
      <div>
        <p className="t-head">На сегодня всё</p>
        <p className="t-sub">Загляните вечером — отметьте, как прошёл день</p>
      </div>
    </div>
  );
}
