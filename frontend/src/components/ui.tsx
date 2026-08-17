"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type MouseEvent, type ReactNode, type TextareaHTMLAttributes } from "react";

import { ArrowGlyph } from "@/components/blocks";
import { tap } from "@/lib/haptics";

const EASE = "cubic-bezier(0.16,1,0.3,1)";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "soft" | "ghost"; arrow?: boolean; size?: "sm" | "md" };

export function Button({ variant = "primary", arrow, size = "md", className = "", children, onClick, ...props }: ButtonProps) {
  const pad = size === "sm" ? "px-3.5 py-1.5 text-[13px]" : "px-5 py-2.5 text-[14px]";
  const base = `group inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition-transform duration-150 active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none ${pad}`;
  const tones =
    variant === "primary" ? "bg-[var(--ink)] text-[var(--bg)] border-[var(--bw)] border-[var(--ink)]" :
    variant === "soft" ? "bg-white text-[var(--ink)] stroke" :
    "text-[var(--muted)] hover:text-[var(--ink)]";
  const handle = (e: MouseEvent<HTMLButtonElement>) => { tap(); onClick?.(e); };
  return (
    <button className={`${base} ${tones} ${className}`} style={{ transitionTimingFunction: EASE }} onClick={handle} {...props}>
      {children}
      {arrow && <ArrowGlyph className="transition-transform duration-150 group-hover:translate-x-0.5" />}
    </button>
  );
}

export function Card({ children, className = "", interactive, style }: { children: ReactNode; className?: string; interactive?: boolean; style?: React.CSSProperties }) {
  return (
    <div className={`chunk p-4 ${interactive ? "transition-transform duration-200 group-active:scale-[0.99]" : ""} ${className}`} style={{ transitionTimingFunction: EASE, ...style }}>
      {children}
    </div>
  );
}

// При фокусе на мобильном подкручиваем поле в центр, чтобы клавиатура не мешала.
function centerOnFocus(el: HTMLElement) {
  setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      onFocus={(e) => { centerOnFocus(e.currentTarget); props.onFocus?.(e); }}
      className={`w-full bg-white px-3.5 py-2.5 text-sm font-semibold text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--muted-2)] ${props.className ?? ""}`}
      style={{ border: "var(--bw) solid var(--stroke)", borderRadius: "var(--r-sm)", scrollMarginBlock: "96px", ...(props.style ?? {}) }}
    />
  );
}

export function Textarea({ autoGrow, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Поле тянется под текст. В анкете просят 400–900 знаков, а окошко на пять
  // строк показывало из них треть: человек правил рассказ вслепую и не видел,
  // где у него абзацы.
  useEffect(() => {
    const el = ref.current;
    if (!autoGrow || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow, props.value]);
  return (
    <textarea
      {...props}
      ref={ref}
      onFocus={(e) => { centerOnFocus(e.currentTarget); props.onFocus?.(e); }}
      className={`w-full resize-none bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--muted-2)] ${props.className ?? ""}`}
      style={{ border: "var(--bw) solid var(--stroke)", borderRadius: "var(--r-sm)", scrollMarginBlock: "96px", ...(autoGrow ? { overflow: "hidden" } : null) }}
    />
  );
}

/**
 * Длинный текст анкеты как его набрали. Пустая строка делит абзацы, одиночный
 * перенос остаётся переносом. Раньше всё это печаталось обычным `<p>`: браузер
 * схлопывал переносы в пробелы, и рассказ о себе слипался в сплошное полотно —
 * в редакторе, в каталоге и в предпросмотре модерации одинаково.
 */
export function Prose({ text, className = "" }: { text: string; className?: string }) {
  const blocks = (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((block) => block.split("\n").map((line) => line.trim()).join("\n").trim())
    .filter(Boolean);
  if (!blocks.length) return null;
  return (
    <div className={className}>
      {blocks.map((block, i) => <p key={i} className={`whitespace-pre-line${i ? " mt-2" : ""}`}>{block}</p>)}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "active" | "planned" | "accent" }) {
  const bg: Record<string, string> = { neutral: "#fff", active: "var(--green)", planned: "var(--purple)", accent: "var(--accent)" };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide" style={{ background: bg[tone], border: "var(--bw) solid var(--stroke)" }}>
      {children}
    </span>
  );
}

// Кольцо в тиффани: вращение и «дыхание» ядра живут в CSS (globals.css),
// поэтому анимация не спотыкается о ре-рендеры React.
export function SpinRing({ size = 28 }: { size?: number }) {
  const ring = Math.max(3, Math.round(size / 8));
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <span className="spin-ring absolute inset-0" style={{ "--ring-w": `${ring}px` } as CSSProperties} />
      <span className="spin-core block rounded-full" style={{ width: Math.round(size / 4.5), height: Math.round(size / 4.5), background: "var(--tiffany-edge)" }} />
    </span>
  );
}

export function Spinner({ label, size = 24 }: { label?: string; size?: number }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px] font-semibold text-[var(--muted)]" role="status">
      <SpinRing size={size} />
      {label ?? "Загрузка"}
    </div>
  );
}

// Пустой экран в ожидании ответа: кольцо по центру и одна строка о том, чего ждём.
export function PageLoader({ label = "Загружаем" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14" role="status">
      <SpinRing size={46} />
      <p className="text-[13px] font-bold text-[var(--muted)]">{label}</p>
    </div>
  );
}

export function SkeletonRow() {
  return <div className="skeleton h-16" />;
}

// Карточка, которой ещё нет: та же геометрия, что у будущей — аватар слева,
// строки справа. Экран не прыгает, когда данные приезжают.
export function SkeletonCard({ lines = 2, delay = 0 }: { lines?: number; delay?: number }) {
  return (
    <div className="card-nested flex items-center gap-3 p-3" style={{ "--sk-delay": `${delay}s` } as CSSProperties}>
      <span className="skeleton h-11 w-11 shrink-0" style={{ borderRadius: 13 }} />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className="skeleton block h-3" style={{ width: i === 0 ? "58%" : "34%", borderRadius: 8 }} />
        ))}
      </span>
    </div>
  );
}

// Пачка скелетон-карточек с лесенкой задержек: блики бегут не в унисон, и
// ожидание читается как поток, а не как мигающая таблица.
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} delay={i * 0.14} />)}
    </div>
  );
}

// Разворачиваемый блок. При открытии сам подкручивает экран так,
// чтобы раскрытый блок оказался в поле зрения (не оставался за нижним краем).
export function Disclosure({ open, children, zoom, autoScroll = true }: { open: boolean; children: ReactNode; zoom?: boolean; autoScroll?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !autoScroll) return;
    const t = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Крутим только если блок вылезает за нижний край или уходит под шапку.
      if (r.bottom > vh - 24 || r.top < 72) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, zoom ? 460 : 320);
    return () => clearTimeout(t);
  }, [open, autoScroll, zoom]);
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          ref={ref}
          initial={{ height: 0, opacity: 0, ...(zoom ? { scale: 1.03 } : {}) }}
          animate={{ height: "auto", opacity: 1, ...(zoom ? { scale: 1 } : {}) }}
          exit={{ height: 0, opacity: 0, ...(zoom ? { scale: 0.98 } : {}) }}
          transition={{ duration: zoom ? 0.42 : 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={zoom ? { transformOrigin: "top center" } : undefined}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
