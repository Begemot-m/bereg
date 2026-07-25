"use client";

import { Icon } from "@/components/icons";
import { select } from "@/lib/haptics";

// Переключатель формата: слово + стрелка, цветной. Онлайн — лавандовый, очно — зелёный.
export function FmtSwitch({ fmt, onToggle, className = "" }: { fmt: "online" | "offline"; onToggle: () => void; className?: string }) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); select(); onToggle(); }}
      className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${className}`}
      style={fmt === "online" ? { background: "var(--purple-soft)", color: "var(--purple-edge)" } : { background: "var(--green-soft)", color: "var(--green-edge)" }}
    >
      {fmt === "online" ? "онлайн" : "очно"}<Icon name="swap" width={9} weight="bold" />
    </button>
  );
}
