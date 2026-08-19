"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ArrowGlyph } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { ProPaywall } from "@/components/pro-sell";
import { tap } from "@/lib/haptics";
import { getSubscription, isPro } from "@/lib/subscription";

export type ProModule = {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
  href: string;
  soft: string;
  edge: string;
  /** Модуль объявлен, но ещё не открыт — внутрь не пускаем даже с PRO. */
  soon?: boolean;
};

// Витрина платных модулей. Порядок — по готовности: работающее сверху.
export const PRO_MODULES: ProModule[] = [
  {
    id: "groups",
    title: "Группы и пары",
    desc: "Парная терапия и ведение групп: состав, приглашения, посещаемость и общая статистика",
    icon: "users",
    href: "/groups",
    soft: "var(--salmon-soft)",
    edge: "var(--salmon-edge)",
  },
  {
    id: "supervision",
    title: "Супервизия",
    desc: "Разбор случаев с супервизором внутри платформы",
    icon: "chalkboard",
    href: "/supervision",
    soft: "var(--alt-soft)",
    edge: "var(--alt-edge)",
    soon: true,
  },
  {
    id: "notes",
    title: "Заметки после сессии",
    desc: "Черновик записи по встрече — остаётся только у вас",
    icon: "note",
    href: "/session-notes",
    soft: "var(--alt-soft)",
    edge: "var(--alt-edge)",
    soon: true,
  },
];

export const findModule = (id: string) => PRO_MODULES.find((m) => m.id === id)!;

function ModuleRow({ mod, locked, onLocked }: { mod: ProModule; locked: boolean; onLocked: () => void }) {
  const dim = Boolean(mod.soon);
  const inner = (
    <>
      <span className="ico h-11 w-11 shrink-0 keep-style" style={{ background: dim ? "var(--surface-2)" : mod.soft }}>
        <Icon name={mod.icon} width={21} weight="bold" color={dim ? "var(--muted-2)" : mod.edge} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-tight text-[15px] font-black leading-tight">{mod.title}</span>
          {mod.soon
            ? <span className="chip keep-style" style={{ background: "var(--head-soft)", color: "var(--muted)" }}>скоро</span>
            : locked && (
              <span className="chip keep-style inline-flex items-center gap-0.5" style={{ background: "var(--purple-soft)", color: "var(--purple-edge)" }}>
                <Icon name="lock" width={9} weight="bold" color="var(--purple-edge)" />PRO
              </span>
            )}
        </span>
        <span className="mt-1 block text-[11.5px] font-semibold leading-snug text-[var(--muted)]">{mod.desc}</span>
      </span>
      {!mod.soon && <ArrowGlyph size={13} />}
    </>
  );

  const cls = "flex w-full items-center gap-3 rounded-[17px] bg-white p-3 text-left transition-transform duration-200 active:scale-[.98]";
  const style = { border: `var(--bw) solid ${dim ? "var(--edge-neutral)" : mod.edge}`, opacity: dim ? 0.6 : 1 };

  if (mod.soon) return <div className={cls} style={style}>{inner}</div>;
  if (locked) return <button onClick={() => { tap(); onLocked(); }} className={cls} style={style}>{inner}</button>;
  return <Link href={mod.href} onClick={() => tap()} className={cls} style={style}>{inner}</Link>;
}

/**
 * Модули на вкладке «Инструменты» у специалиста. Заперто — не мёртвая кнопка:
 * тап открывает витрину PRO, где этот модуль и продаётся.
 */
export function ModulesShelf() {
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const pro = isPro(sub);
  const [asked, setAsked] = useState<ProModule | null>(null);

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Модули</p>
        {!pro && <p className="text-[10.5px] font-bold text-[var(--muted-2)]">входят в подписку PRO</p>}
      </div>
      <div className="flex flex-col gap-2.5">
        {PRO_MODULES.map((m, i) => (
          <Reveal key={m.id} delay={0.03 + i * 0.04}>
            <ModuleRow mod={m} locked={!pro} onLocked={() => setAsked(m)} />
          </Reveal>
        ))}
      </div>
      <ProPaywall
        open={Boolean(asked)}
        onClose={() => setAsked(null)}
        reason={asked ? `Модуль «${asked.title}» входит в подписку PRO` : undefined}
      />
    </>
  );
}

/**
 * Замок на самой странице модуля: по прямой ссылке сюда попадают и без PRO.
 * Показываем, что внутри, и тем же окном предлагаем подписку.
 */
export function ModuleLocked({ mod, points }: { mod: ProModule; points: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="rounded-[19px] bg-white p-4" style={{ border: `var(--bw) solid ${mod.edge}` }}>
        <span className="ico h-12 w-12 keep-style" style={{ background: mod.soft }}>
          <Icon name={mod.icon} width={23} weight="bold" color={mod.edge} />
        </span>
        <h2 className="mt-3 font-tight text-[19px] font-black leading-tight">{mod.title}</h2>
        <p className="mt-1 text-[12px] font-semibold leading-snug text-[var(--muted)]">{mod.desc}</p>
        <div className="mt-3 flex flex-col gap-1.5">
          {points.map((p) => (
            <span key={p} className="flex items-start gap-2 text-[12px] font-bold leading-snug">
              <Icon name="check" width={13} weight="bold" color={mod.edge} />
              <span className="min-w-0 flex-1">{p}</span>
            </span>
          ))}
        </div>
        <button onClick={() => { tap(); setOpen(true); }} className="btn mt-4 w-full py-3">Открыть модуль в PRO</button>
      </div>
      <ProPaywall open={open} onClose={() => setOpen(false)} reason={`Модуль «${mod.title}» входит в подписку PRO`} />
    </>
  );
}
