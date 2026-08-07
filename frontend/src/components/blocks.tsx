"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { tap } from "@/lib/haptics";

const EASE = "cubic-bezier(0.16,1,0.3,1)";

export function PageHead({ title, sub, subIcon, icon, back, right, children }: { title: string; sub?: string; subIcon?: IconName; icon?: IconName; back?: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <div
      className="mb-5 -mx-4 px-5 pb-3 pt-1 @md:mx-0 @md:px-1 @md:pt-4"
      style={{ background: "var(--page)" }}
    >
      {back && (
        <Link href={back} onClick={tap} aria-label="Назад" className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white transition-transform active:scale-95">
          <ArrowGlyph size={16} style={{ transform: "rotate(180deg)" }} />
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Пружина на иконке заставляла дрожать соседний заголовок: каждый
              её кадр перерисовывал общую строку. Мягкий tween и собственный
              слой держат текст неподвижным. */}
          {icon && (
            <motion.span
              initial={{ scale: 0.86, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: "transform", backfaceVisibility: "hidden" }}
              className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[20px] bg-white"
            >
              <Icon name={icon} width={36} weight="bold" color="var(--edge)" />
            </motion.span>
          )}
          <div className="min-w-0">
            <h1 className="font-tight text-[28px] font-extrabold leading-[1.1] @md:text-[34px]">{title}</h1>
            {sub && (
              subIcon
                ? <span className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-black capitalize"><Icon name={subIcon} width={14} weight="bold" color="var(--ink)" /> {sub}</span>
                : <p className="font-tight mt-1 text-[13px] font-bold" style={{ color: "rgba(32,28,24,.6)" }}>{sub}</p>
            )}
          </div>
        </div>
        {right}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/**
 * Дейлик — персиковый кружок с жёлтым «!». Мигает, пока задание дня не пройдено:
 * значит, сюда надо ткнуть. Один вид на весь проект.
 */
export function DailyDot({ size = 22, className, label = "Задание дня — пройдите его" }: { size?: number; className?: string; label?: string }) {
  return (
    <motion.span
      role="img"
      aria-label={label}
      title={label}
      className={`daily-dot ${className ?? ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}
      animate={{ scale: [1, 1.16, 1], opacity: [1, 0.72, 1] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    >
      !
    </motion.span>
  );
}

/**
 * Форма стрелки. Одна на весь проект: линия с наконечником.
 * Поворотом получаем «назад» (180°), «вниз»/«раскрыть» (90°).
 */
export function ArrowGlyph({ size = 15, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className={className} style={style}>
      <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Стрелка «дальше» в круге. Вид круга меняется в .arrow в globals.css. */
export function Arrow() {
  return <span className="arrow" aria-hidden><ArrowGlyph /></span>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{children}</h2>
      {action}
    </div>
  );
}

function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setValue(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const numeric = /^\d+$/.test(value);
  const animated = useCountUp(numeric ? Number(value) : 0);
  return (
    <div className="chunk p-4" style={accent ? { background: "var(--accent)" } : undefined}>
      <p className="tnum font-tight text-[28px] font-extrabold leading-none">{numeric ? animated : value}</p>
      <p className="mt-1 text-[12px] font-bold text-[var(--muted)]">{label}</p>
    </div>
  );
}

type Fill = "cream" | "iris" | "sage" | "ink" | "amber" | "green" | "purple" | "coral" | "salmon";

const FILL_VAR: Record<string, string | undefined> = {
  cream: undefined,
  ink: "var(--ink)",
  iris: "var(--purple)",
  sage: "var(--green)",
  amber: "var(--amber)",
  green: "var(--green)",
  purple: "var(--purple)",
  coral: "var(--coral)",
  salmon: "var(--salmon)",
};

export function ModuleCard({ title, desc, icon, fill = "cream", href, onClick }: { title: string; desc: string; icon: IconName; fill?: Fill; href?: string; onClick?: () => void }) {
  const bg = FILL_VAR[fill];
  const dark = fill === "ink";
  const inner = (
    <div
      className="chunk group flex h-full flex-col justify-between p-4 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
      style={{ background: bg, color: dark ? "#fff" : undefined, transitionTimingFunction: EASE }}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[13px]" style={{ background: "#fff" }}>
        <Icon name={icon} width={21} weight="regular" color={dark ? "var(--ink)" : "var(--edge)"} />
      </span>
      <div className="mt-6">
        <p className="text-[15px] font-extrabold">{title}</p>
        <p className={`mt-0.5 text-[12.5px] font-semibold ${dark ? "opacity-80" : "text-[var(--muted)]"}`}>{desc}</p>
      </div>
    </div>
  );
  if (href) return <Link href={href} onClick={tap} className="block h-full">{inner}</Link>;
  return <button onClick={() => { tap(); onClick?.(); }} className="block h-full w-full text-left">{inner}</button>;
}
