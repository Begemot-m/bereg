"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Block, WebTitle } from "@/components/web-ui";
import { useWebMode } from "@/lib/web-mode";

export function TherapyDetailShell({ backHref, backLabel, title, subtitle, icon, accent = "tiffany", children }: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle: string;
  icon: IconName;
  /** Тон экрана: заметки — тиффани, задания — лавандовый, как весь раздел. */
  accent?: "tiffany" | "purple";
  children: ReactNode;
}) {
  const web = useWebMode();
  if (web)
    return (
      <div data-accent={accent}>
        <Link href={backHref} className="back-link mb-3">{backLabel}</Link>
        <WebTitle title={title} sub={subtitle} />
        <Block className="rounded-[18px] p-5" style={{ background: "var(--surface)" }}>{children}</Block>
      </div>
    );
  return (
    <div data-accent={accent} className="-mx-4 -mt-6 min-h-full @md:-mx-9" style={{ background: "var(--page)" }}>
      <header className="px-4 pb-14 pt-4 @md:px-9">
        <Link href={backHref} className="back-link mb-4 mt-3">{backLabel}</Link>
        <div className="flex items-center gap-3">
          <span className="ico ico-accent h-12 w-12 shrink-0"><Icon name={icon} width={23} weight="bold" /></span>
          <div className="min-w-0"><h1 className="t-display leading-tight">{title}</h1><p className="t-sub mt-1">{subtitle}</p></div>
        </div>
      </header>
      <main className="-mt-8 min-h-[60vh] rounded-t-[27px] bg-white px-4 pb-10 pt-6 @md:px-9">
        {children}
      </main>
    </div>
  );
}
