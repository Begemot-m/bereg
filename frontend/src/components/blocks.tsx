"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { tap } from "@/lib/haptics";

const EASE = "cubic-bezier(0.16,1,0.3,1)";

export function PageHead({ title, sub, subIcon, right, children }: { title: string; sub?: string; subIcon?: IconName; right?: ReactNode; children?: ReactNode }) {
  return (
    <div
      className="mb-5 -mx-4 px-5 pb-3 pt-1 @md:mx-0 @md:px-1 @md:pt-4"
      style={{ background: "var(--page)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-tight text-[24px] font-extrabold leading-tight @md:text-3xl">{title}</h1>
          {sub && (
            subIcon
              ? <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-black capitalize" style={{ border: "var(--bw) solid var(--edge)", color: "var(--edge)" }}><Icon name={subIcon} width={13} weight="bold" /> {sub}</span>
              : <p className="mt-1 text-[13px] font-semibold" style={{ color: "rgba(32,28,24,.6)" }}>{sub}</p>
          )}
        </div>
        {right}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
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
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] stroke" style={{ background: "#fff" }}>
        <Icon name={icon} width={21} weight="regular" color="var(--ink)" />
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
