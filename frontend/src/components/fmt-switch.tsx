"use client";

import { Icon } from "@/components/icons";
import { select } from "@/lib/haptics";

// Переключатель формата: слово + стрелка, цветной. Онлайн — лавандовый, очно — зелёный.
export function FmtSwitch({ fmt, onToggle, className = "" }: { fmt: "online" | "offline"; onToggle: () => void; className?: string }) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); select(); onToggle(); }}
      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase stroke ${className}`}
      style={fmt === "online" ? { background: "var(--purple-soft)", borderColor: "var(--purple-edge)", color: "var(--ink)" } : { background: "var(--green-soft)", borderColor: "var(--green-edge)", color: "var(--ink)" }}
    >
      {fmt === "online" ? "онлайн" : "очно"}<Icon name="swap" width={9} weight="bold" />
    </button>
  );
}
