"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ArrowGlyph } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { ProPaywall } from "@/components/pro-sell";
import { tap } from "@/lib/haptics";
import { GROUPS_LIVE } from "@/lib/modules";
import { getSubscription, isPro } from "@/lib/subscription";

export type ProModule = {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
  href: string;
  soft: string;
  edge: string;
  /** Модуль открыт пользователям. Нет — на витрине стоит «Скоро в PRO». */
  live: boolean;
};

// Витрина платных модулей. Пока модуль один — карточка идёт во всю ширину.
export const PRO_MODULES: ProModule[] = [
  {
    id: "groups",
    title: "Группы и пары",
    desc: "Организуйте работу групповых и парных консультаций. Модуль расширяет основные функции платформы для работы с несколькими пользователями.",
    icon: "users",
    href: "/groups",
    soft: "var(--salmon-soft)",
    edge: "var(--salmon-edge)",
    live: GROUPS_LIVE,
  },
];

export const findModule = (id: string) => PRO_MODULES.find((m) => m.id === id)!;

/**
 * Фон карточки модуля. Картинки для групп нет, и рисовать её незачем: круги
 * участников вокруг ведущего читаются с одного взгляда и живут в тоне раздела.
 */
function GroupsArt({ edge, soft }: { edge: string; soft: string }) {
  const dot = (size: number, opacity: number) => (
    <span className="keep-style flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: "#fff", opacity, border: `2px solid ${edge}` }}>
      <Icon name="user" width={size * 0.5} weight="bold" color={edge} />
    </span>
  );
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2" style={{ background: soft }}>
      {dot(28, 0.55)}
      {dot(40, 0.8)}
      <span className="keep-style flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ background: edge }}>
        <Icon name="users" width={28} weight="bold" color="#fff" />
      </span>
      {dot(40, 0.8)}
      {dot(28, 0.55)}
    </span>
  );
}

function ModuleTile({ mod, locked, onLocked }: { mod: ProModule; locked: boolean; onLocked: () => void }) {
  // Модуль ещё не открыт: карточка на месте, но приглушена и никуда не ведёт —
  // обещание, а не мёртвая кнопка, которая уводит в пустой раздел.
  const soon = !mod.live;
  const inner = (
    <>
      <span className="relative flex h-[104px] items-center justify-center overflow-hidden">
        <GroupsArt edge={mod.edge} soft={mod.soft} />
        <span className="keep-style absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[.06em]" style={{ color: "var(--purple-edge)" }}>
          <Icon name={soon || locked ? "lock" : "spark"} width={11} weight={soon || locked ? "bold" : "fill"} color="var(--purple-edge)" />
          {soon ? "Скоро в PRO" : "PRO"}
        </span>
      </span>
      <span className="flex flex-1 flex-col bg-white p-3">
        <span className="font-tight text-[15px] font-black leading-tight">{mod.title}</span>
        <span className="mt-1 text-[11px] font-semibold leading-snug text-[var(--muted)]">{mod.desc}</span>
        {soon ? (
          <span className="mt-3 flex items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-black" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
            <Icon name="clock" width={12} weight="bold" color="var(--muted)" /> Скоро
          </span>
        ) : (
          <span className="mt-3 flex items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-black text-white" style={{ background: mod.edge }}>
            {locked ? "Подключить" : "Перейти"} <ArrowGlyph size={12} />
          </span>
        )}
      </span>
    </>
  );

  const cls = "group relative flex w-full flex-col overflow-hidden rounded-[19px] text-left transition-transform duration-200 active:scale-[.98]";
  const style = { border: `var(--bw) solid ${mod.edge}` };

  // Затенение — поверх всей плитки, чтобы приглушить и картинку, и текст.
  if (soon) {
    return (
      <div className={`${cls} cursor-default`} style={{ ...style, borderColor: "var(--edge-neutral)" }} aria-disabled>
        <span className="pointer-events-none absolute inset-0 z-[1]" style={{ background: "color-mix(in srgb, var(--surface) 62%, transparent)" }} />
        {inner}
      </div>
    );
  }
  if (locked) return <button onClick={() => { tap(); onLocked(); }} className={cls} style={style}>{inner}</button>;
  return <Link href={mod.href} onClick={() => tap()} className={cls} style={style}>{inner}</Link>;
}

/**
 * Страница модуля, который ещё не открыт. По прямой ссылке сюда попадают и
 * без витрины, поэтому заглушка живёт на самой странице, а не только на плитке.
 */
export function ModuleSoon({ mod }: { mod: ProModule }) {
  return (
    <div className="rounded-[19px] bg-white p-5 text-center" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      <span className="ico keep-style mx-auto h-12 w-12" style={{ background: "var(--surface-2)" }}>
        <Icon name="lock" width={22} weight="bold" color="var(--muted)" />
      </span>
      <h2 className="mt-3 font-tight text-[19px] font-black leading-tight">{mod.title}</h2>
      <p className="mx-auto mt-1 max-w-[280px] text-[12px] font-semibold leading-snug text-[var(--muted)]">
        Модуль готовим — он появится в подписке PRO. Пока пользоваться им нельзя.
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[.06em]" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
        <Icon name="clock" width={12} weight="bold" color="var(--muted)" /> Скоро в PRO
      </span>
    </div>
  );
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
            <ModuleTile mod={m} locked={!pro} onLocked={() => setAsked(m)} />
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
