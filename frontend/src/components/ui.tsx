"use client";

import { AnimatePresence, motion } from "motion/react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  MouseEvent,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

import { tap } from "@/lib/haptics";

const EASE = "cubic-bezier(0.16,1,0.3,1)";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft" | "ghost";
  arrow?: boolean;
  size?: "sm" | "md";
};

export function Button({ variant = "primary", arrow, size = "md", className = "", children, onClick, ...props }: ButtonProps) {
  const pad = size === "sm" ? "px-3.5 py-2 text-[13px]" : "px-5 py-3 text-[14px]";
  const base = `group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color,color,box-shadow] duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${pad}`;
  const tones =
    variant === "primary"
      ? "text-white"
      : variant === "soft"
        ? "bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[#eae7de]"
        : "text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--ink)]";

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    tap();
    onClick?.(e);
  };

  return (
    <button
      className={`${base} ${tones} ${className}`}
      style={{ transitionTimingFunction: EASE, ...(variant === "primary" ? { background: "var(--a1)" } : {}) }}
      onClick={handleClick}
      {...props}
    >
      {children}
      {arrow && (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="transition-transform duration-200 group-hover:translate-x-0.5">
          <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function Card({ children, className = "", interactive, style }: { children: ReactNode; className?: string; interactive?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      className={`bg-[var(--surface)] p-5 transition-[transform,box-shadow] duration-300 ${interactive ? "group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lift)]" : ""} ${className}`}
      style={{ borderRadius: "var(--r-block)", boxShadow: "var(--shadow)", transitionTimingFunction: EASE, ...style }}
    >
      {children}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition-colors duration-200 placeholder:text-[var(--muted-2)] focus:bg-white ${props.className ?? ""}`}
      style={{ borderRadius: "var(--r-input)", border: "1.5px solid transparent", ...(props.style ?? {}) }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--a1)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full resize-none bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition-colors duration-200 placeholder:text-[var(--muted-2)] focus:bg-white ${props.className ?? ""}`}
      style={{ borderRadius: "var(--r-input)", border: "1.5px solid transparent" }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--a1)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
    />
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "active" | "planned" | "accent" }) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: { color: "var(--muted)", background: "var(--surface-2)" },
    active: { color: "#fff", background: "var(--good)" },
    planned: { color: "#fff", background: "var(--iris)" },
    accent: { color: "#fff", background: "var(--a1)" },
  };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={styles[tone]}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--a1)", animation: "pulse-soft 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      {label ?? "Загрузка"}
    </div>
  );
}

export function SkeletonRow() {
  return <div className="skeleton h-16" style={{ borderRadius: "var(--r-block)" }} />;
}

/* Раскрывающийся блок: доп. опции прячутся, а не навалены на экран */
export function Disclosure({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
