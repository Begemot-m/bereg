"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { ArrowGlyph } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { GroupsArt, PRO_MODULES, type ProModule } from "@/components/pro-modules";
import { ProPaywall } from "@/components/pro-sell";
import type { TechKey } from "@/components/techniques";
import { Block, Decor, INK, pill, SUB, WebTitle } from "@/components/web-ui";
import { asset } from "@/lib/asset";
import { tap } from "@/lib/haptics";
import { getSubscription, isPro } from "@/lib/subscription";

const TechniqueRunner = dynamic(() => import("@/components/techniques").then((m) => m.TechniqueRunner));
const TraitTest = dynamic(() => import("@/components/trait-test").then((m) => m.TraitTest));

export const CLIENT_PRACTICES: { tech: TechKey; title: string; desc: string; time: string; image: string; bg: string; edge: string; soon?: boolean }[] = [
  { tech: "breathing", title: "Спокойное дыхание", desc: "Снизить напряжение здесь и сейчас", time: "1–5 мин", image: "/practices/breathing-practice.webp", bg: "#d9edf3", edge: "#5f95ab" },
  { tech: "thought", title: "Дневник мыслей", desc: "Отслеживать негативные убеждения и переформулировать их по методу КПТ", time: "2–7 мин", image: "/practices/automatic-thoughts.webp", bg: "var(--purple-soft)", edge: "var(--purple-edge)", soon: true },
];

// Пять дорожек, которые заполняются по очереди — «тест проходят прямо сейчас».
export function FillGlyph() {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden className="flex w-[44px] shrink-0 flex-col gap-[5px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="block h-[6px] overflow-hidden rounded-full" style={{ background: "#efeae2" }}>
          <motion.span
            className="block h-full rounded-full"
            style={{ background: "var(--purple-edge)" }}
            initial={{ width: reduce ? "60%" : "0%" }}
            animate={reduce ? undefined : { width: ["0%", "100%", "100%", "0%"] }}
            transition={{ duration: 3.6, times: [0, 0.34, 0.74, 1], repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
          />
        </span>
      ))}
    </span>
  );
}

const TILE = "relative flex h-full min-h-[178px] flex-col overflow-hidden rounded-[16px] p-4";

export function WebTools({ psy }: { psy: boolean }) {
  const [tech, setTech] = useState<TechKey | null>(null);
  const [test, setTest] = useState(false);
  const [asked, setAsked] = useState<ProModule | null>(null);
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription, enabled: psy });
  const pro = isPro(sub);
  // У специалиста строк на одну больше: две быстрые плитки занимают ряд целиком.
  const quick = psy ? "xl:col-span-2" : "";

  return (
    <div data-wide className="pb-4">
      <WebTitle title="Инструменты" />

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <Block delay={0.02} className={`${TILE} md:col-span-2`} style={{ background: "var(--ink)", color: "#fff" }}>
          <span className="flex items-start justify-between gap-3">
            <span className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em]" style={{ background: "rgba(255,255,255,.16)" }}>Скоро в Хронике</span>
            <Icon name="compass" width={22} color="#fff" />
          </span>
          <span className="mt-auto">
            <span className="block text-[20px] font-black leading-[1.1]">Больше опоры между встречами</span>
            <span className="mt-1.5 block max-w-[360px] text-[11px] font-semibold leading-snug text-white/70">AI-ассистент, база знаний и новые практики уже в работе.</span>
          </span>
        </Block>

        {psy && PRO_MODULES.map((m, i) => (
          <ModuleTile key={m.id} mod={m} locked={!pro} delay={0.06 + i * 0.03} onLocked={() => setAsked(m)} />
        ))}

        {CLIENT_PRACTICES.map((t, i) => (
          <Block key={t.tech} delay={0.08 + i * 0.03} className={TILE} style={{ background: t.bg }}>
            <img
              src={asset(t.image)}
              alt=""
              loading="lazy"
              decoding="async"
              className="dash-decor pointer-events-none absolute -right-2 -top-2 h-[96px] w-[96px] object-contain"
              data-kind="triangle"
              style={t.soon ? { filter: "grayscale(.55)", opacity: 0.5 } : undefined}
            />
            <span className="relative inline-flex w-fit items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9px] font-bold" style={{ color: t.edge }}>
              <Icon name="clock" width={10} weight="bold" color={t.edge} />{t.time}
            </span>
            <span className="relative mt-auto block pr-6 text-[14px] font-black leading-tight" style={{ color: INK }}>{t.title}</span>
            <span className="relative mt-1 block text-[11px] font-medium leading-snug" style={{ color: SUB }}>{t.desc}</span>
            {t.soon ? (
              <span className="relative mt-3 w-fit rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em]" style={{ background: "rgba(255,255,255,.6)", color: SUB }}>в разработке</span>
            ) : (
              <button onClick={() => { tap(); setTech(t.tech); }} className={`${pill} relative mt-3`} style={{ background: INK }}>
                Начать <ArrowGlyph size={12} />
              </button>
            )}
          </Block>
        ))}

        <Block delay={0.14} className={`${TILE} md:col-span-2`} style={{ background: "var(--purple-soft)" }}>
          <Decor kind="plus" />
          <span className="relative"><FillGlyph /></span>
          <span className="relative mt-auto block text-[14px] font-black leading-tight" style={{ color: INK }}>Тест на тип личности</span>
          <span className="relative mt-1 block max-w-[420px] text-[11px] font-medium leading-snug" style={{ color: SUB }}>
            Помогает определить сильные и слабые стороны проявления вашего типа в стрессе.
          </span>
          <span className="relative mt-3 flex items-center gap-3">
            <button onClick={() => { tap(); setTest(true); }} className={pill} style={{ background: INK }}>Пройти тест</button>
            <span className="text-[10px] font-bold" style={{ color: SUB }}>от 12 минут</span>
          </span>
        </Block>

        <QuickTile href="/therapy" icon="mood" title="Отметить настроение" hint="быстрый чек-ин" bg="var(--green-soft)" mid="var(--green)" delay={0.17} className={quick} />
        <QuickTile href="/therapy" icon="balance" title="Колесо баланса" hint="сферы жизни" bg="var(--amber-soft)" mid="var(--amber)" delay={0.2} className={quick} />
      </div>

      <p className="mt-4 max-w-[640px] text-[10px] font-semibold leading-relaxed" style={{ color: "var(--muted-2)" }}>
        Инструменты не заменяют медицинскую помощь. Результаты остаются на этом устройстве и не отправляются терапевту автоматически.
      </p>

      {tech && <TechniqueRunner tech={tech} onClose={() => setTech(null)} />}
      {test && <TraitTest onClose={() => setTest(false)} />}
      <ProPaywall
        open={Boolean(asked)}
        onClose={() => setAsked(null)}
        reason={asked ? `Модуль «${asked.title}» входит в подписку PRO` : undefined}
      />
    </div>
  );
}

function ModuleTile({ mod, locked, delay, onLocked }: { mod: ProModule; locked: boolean; delay: number; onLocked: () => void }) {
  const soon = !mod.live;
  return (
    <Block delay={delay} className={`${TILE} md:col-span-2`} style={{ background: mod.soft }}>
      <span className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] sm:block" style={{ opacity: soon ? 0.45 : 1 }}>
        <GroupsArt edge={mod.edge} soft={mod.soft} />
      </span>
      <span className="relative inline-flex w-fit items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--purple-edge)" }}>
        <Icon name={soon || locked ? "lock" : "spark"} width={10} weight={soon || locked ? "bold" : "fill"} color="var(--purple-edge)" />
        {soon ? "Скоро в PRO" : "PRO"}
      </span>
      <span className="relative mt-auto block text-[16px] font-black leading-tight sm:max-w-[54%]" style={{ color: INK }}>{mod.title}</span>
      <span className="relative mt-1 block text-[11px] font-medium leading-snug sm:max-w-[54%]" style={{ color: SUB }}>{mod.desc}</span>
      {!soon && (
        locked ? (
          <button onClick={() => { tap(); onLocked(); }} className={`${pill} relative mt-3`} style={{ background: INK }}>Подключить</button>
        ) : (
          <Link href={mod.href} onClick={() => tap()} className={`${pill} relative mt-3`} style={{ background: INK }}>
            Перейти <ArrowGlyph size={12} />
          </Link>
        )
      )}
    </Block>
  );
}

function QuickTile({ href, icon, title, hint, bg, mid, delay, className }: { href: string; icon: IconName; title: string; hint: string; bg: string; mid: string; delay: number; className?: string }) {
  return (
    <Block delay={delay} className={`${TILE} ${className ?? ""}`} style={{ background: bg }}>
      <Link href={href} onClick={() => tap()} className="absolute inset-0 rounded-[16px]" aria-label={title} />
      <span className="pointer-events-none flex h-9 w-9 items-center justify-center rounded-full" style={{ background: mid }}>
        <Icon name={icon} width={17} color={INK} />
      </span>
      <span className="pointer-events-none mt-auto block text-[14px] font-black leading-tight" style={{ color: INK }}>{title}</span>
      <span className="pointer-events-none mt-1 block text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: INK, opacity: 0.55 }}>{hint}</span>
    </Block>
  );
}
