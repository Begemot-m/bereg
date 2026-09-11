"use client";

import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

export const EASE = [0.16, 1, 0.3, 1] as const;
export const INK = "#201c18";
export const LINE = "var(--hairline)";
export const SUB = "var(--muted)";
export const PAPER = "var(--surface)";

/** Блок веб-экрана: появляется снизу с задержкой по очереди и дальше стоит на
 *  месте. Под курсором оживает содержимое — `.dash-*` в globals.css. */
export function Block({
  children,
  className,
  style,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: EASE }}
      className={`dash-block ${className ?? ""}`}
      style={style}
    >
      {children}
    </motion.section>
  );
}

export function Decor({ kind }: { kind: "plus" | "heart" | "triangle" | "burst" }) {
  const style = {
    position: "absolute" as const,
    right: -10,
    top: -10,
    opacity: kind === "plus" || kind === "heart" ? 0.12 : 0.16,
    pointerEvents: "none" as const,
  };
  if (kind === "plus") {
    return <svg className="dash-decor" data-kind={kind} width="88" height="88" viewBox="0 0 24 24" fill={INK} style={style}><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" /></svg>;
  }
  if (kind === "heart") {
    return <svg className="dash-decor" data-kind={kind} width="120" height="120" viewBox="0 0 24 24" fill={INK} style={style}><path d="M12 21s-8-5.3-8-11a4.6 4.6 0 018-3 4.6 4.6 0 018 3c0 5.7-8 11-8 11z" /></svg>;
  }
  if (kind === "triangle") {
    return <svg className="dash-decor" data-kind={kind} width="72" height="72" viewBox="0 0 24 24" fill={INK} style={{ ...style, top: -6 }}><path d="M12 3l9 18H3z" /></svg>;
  }
  return <svg className="dash-decor" data-kind={kind} width="72" height="72" viewBox="0 0 24 24" fill={INK} style={{ ...style, top: -6 }}><path d="M12 2l2.4 6.3L21 6l-3.3 6L21 18l-6.6-2.3L12 22l-2.4-6.3L3 18l3.3-6L3 6l6.6 2.3z" /></svg>;
}

export function BlockTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="relative flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-black leading-none" style={{ color: INK }}>{children}</h2>
      {right}
    </div>
  );
}

export function WebTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="mr-auto min-w-0">
        <h1 className="text-[28px] font-[650] leading-none tracking-tight">{title}</h1>
        {sub && <div className="mt-1.5 text-[12px] font-semibold" style={{ color: SUB }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/** Основная кнопка веба — чёрная пилюля по своему тексту, не во всю ширину. */
export const pill = "inline-flex h-8 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[11px] font-bold text-white disabled:opacity-45";
export const pillSoft = "inline-flex h-8 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[11px] font-bold disabled:opacity-45";
