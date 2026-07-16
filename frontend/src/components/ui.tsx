"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, MouseEvent, ReactNode, TextareaHTMLAttributes } from "react";

import { tap } from "@/lib/haptics";

const EASE = "cubic-bezier(0.16,1,0.3,1)";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "soft" | "ghost"; arrow?: boolean; size?: "sm" | "md" };

export function Button({ variant = "primary", arrow, size = "md", className = "", children, onClick, ...props }: ButtonProps) {
  const pad = size === "sm" ? "px-3.5 py-1.5 text-[13px]" : "px-5 py-2.5 text-[14px]";
  const base = `group inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition-transform duration-150 active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none ${pad}`;
  const tones =
    variant === "primary" ? "bg-[var(--ink)] text-[var(--bg)] stroke" :
    variant === "soft" ? "bg-white text-[var(--ink)] stroke" :
    "text-[var(--muted)] hover:text-[var(--ink)]";
  const handle = (e: MouseEvent<HTMLButtonElement>) => { tap(); onClick?.(e); };
  return (
    <button className={`${base} ${tones} ${className}`} style={{ transitionTimingFunction: EASE }} onClick={handle} {...props}>
      {children}
      {arrow && (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="transition-transform duration-150 group-hover:translate-x-0.5">
          <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
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

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-white px-3.5 py-2.5 text-sm font-semibold text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--muted-2)] ${props.className ?? ""}`}
      style={{ border: "var(--bw) solid var(--stroke)", borderRadius: "var(--r-sm)", ...(props.style ?? {}) }}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full resize-none bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--muted-2)] ${props.className ?? ""}`}
      style={{ border: "var(--bw) solid var(--stroke)", borderRadius: "var(--r-sm)" }}
    />
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

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--muted)]">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: "var(--ink)", animation: "pulse-soft 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />)}
      </span>
      {label ?? "Загрузка"}
    </div>
  );
}

export function SkeletonRow() {
  return <div className="skeleton h-16" />;
}

export function Disclosure({ open, children, zoom }: { open: boolean; children: ReactNode; zoom?: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
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
