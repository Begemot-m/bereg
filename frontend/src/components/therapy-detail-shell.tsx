import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";

export function TherapyDetailShell({ backHref, backLabel, title, subtitle, icon, children }: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle: string;
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <div data-accent="tiffany" className="-mx-4 -mt-6 min-h-full @md:-mx-9" style={{ background: "var(--page)" }}>
      <header className="px-4 pb-14 pt-4 @md:px-9">
        <Link href={backHref} className="back-link mb-4">{backLabel}</Link>
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
