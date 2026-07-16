"use client";

import type { ReactNode } from "react";

export function SectionHead({ title, subtitle, right, children }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <div className="chunk mb-5 p-4" style={{ background: "var(--head)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-tight text-[22px] font-extrabold leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[13px] font-semibold" style={{ color: "rgba(32,28,24,.62)" }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
