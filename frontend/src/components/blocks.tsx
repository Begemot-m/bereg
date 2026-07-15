"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { tap } from "@/lib/haptics";

const EASE = "cubic-bezier(0.16,1,0.3,1)";

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-tight text-[28px] font-extrabold leading-none @md:text-4xl">{title}</h1>
      {sub && <p className="mt-1.5 text-sm text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-bold text-[var(--muted)]">{children}</h2>
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
    <div className="p-4" style={{ borderRadius: "var(--r-block)", background: accent ? "var(--a1)" : "var(--surface)", color: accent ? "#fff" : undefined, boxShadow: accent ? "none" : "var(--shadow)" }}>
      <p className="tnum font-tight text-[30px] font-extrabold leading-none">{numeric ? animated : value}</p>
      <p className={`mt-1 text-[12px] font-semibold ${accent ? "opacity-85" : "text-[var(--muted)]"}`}>{label}</p>
    </div>
  );
}

type Fill = "cream" | "iris" | "sage" | "ink";

export function ModuleCard({ title, desc, icon, fill = "cream", href, onClick }: { title: string; desc: string; icon: IconName; fill?: Fill; href?: string; onClick?: () => void }) {
  const solid = fill !== "cream";
  const inner = (
    <div
      className={`group flex h-full flex-col justify-between p-4 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] active:scale-[0.98] fill-${fill}`}
      style={{ borderRadius: "var(--r-block)", boxShadow: solid ? "none" : "var(--shadow)", transitionTimingFunction: EASE }}
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: solid ? "rgba(255,255,255,0.18)" : "var(--a-tint)" }}>
          <Icon name={icon} width={20} weight={solid ? "fill" : "regular"} color={solid ? "#fff" : "var(--a1)"} />
        </span>
      </div>
      <div className="mt-6">
        <p className="text-[15px] font-bold">{title}</p>
        <p className={`mt-0.5 text-[12.5px] ${solid ? "opacity-80" : "text-[var(--muted)]"}`}>{desc}</p>
      </div>
    </div>
  );
  if (href) return <Link href={href} onClick={tap} className="block h-full">{inner}</Link>;
  return <button onClick={() => { tap(); onClick?.(); }} className="block h-full w-full text-left">{inner}</button>;
}
