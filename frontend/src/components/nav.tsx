"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Клиенты" },
  { href: "/schedule", label: "Расписание" },
  { href: "/billing", label: "Подписка" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <nav
        className="pointer-events-auto flex gap-1 rounded-full p-1.5 backdrop-blur-2xl"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--hairline)" }}
      >
        {items.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className="relative rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors duration-300"
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-full"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--hairline)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className={`relative ${active ? "iris-text" : "text-[var(--muted)]"}`}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
