"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Onboarding } from "@/components/onboarding";
import { APP_NAME } from "@/lib/brand";
import { select } from "@/lib/haptics";
import { useOnboarded } from "@/lib/profile";
import { ROLE_LABEL, useRole, type Role } from "@/lib/role";

type NavItem = { href: string; label: string; icon: IconName };

const NAV: Record<Role, NavItem[]> = {
  psychologist: [
    { href: "/", label: "Главная", icon: "home" },
    { href: "/sessions", label: "Сессии", icon: "calendar" },
    { href: "/clients", label: "Клиенты", icon: "users" },
    { href: "/tools", label: "Инструменты", icon: "tools" },
  ],
  client: [
    { href: "/", label: "Главная", icon: "home" },
    { href: "/sessions", label: "Сессии", icon: "calendar" },
    { href: "/catalog", label: "Каталог", icon: "compass" },
  ],
  guest: [
    { href: "/", label: "Главная", icon: "home" },
    { href: "/sessions", label: "Сессии", icon: "calendar" },
    { href: "/catalog", label: "Каталог", icon: "compass" },
  ],
};

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function accentFor(pathname: string) {
  if (pathname.startsWith("/sessions")) return "green";
  if (pathname.startsWith("/clients")) return "purple";
  if (pathname.startsWith("/tools")) return "coral";
  if (pathname.startsWith("/catalog")) return "salmon";
  return "amber";
}

function Wordmark({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[16px] font-black text-[var(--bg)] stroke" style={{ background: "var(--ink)" }}>
        {APP_NAME.charAt(0)}
      </span>
      <span className={`font-tight font-extrabold ${small ? "text-lg" : "text-xl"}`}>{APP_NAME}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [role] = useRole();
  const pathname = usePathname();
  const [onboarded] = useOnboarded();
  const items = NAV[role];
  const cabinetActive = pathname.startsWith("/cabinet");
  const accent = accentFor(pathname);
  const tabs: NavItem[] = [...items, { href: "/cabinet", label: "Кабинет", icon: "user" }];

  if (onboarded === null) return <div className="min-h-[100dvh]" style={{ background: "var(--bg)" }} />;
  if (!onboarded) return <Onboarding />;

  return (
    <div data-accent={accent} className="@container min-h-[100dvh]">
      {/* Десктоп: сайдбар */}
      <aside className="fixed left-0 top-0 z-30 hidden h-full w-[248px] flex-col justify-between px-4 py-6 @md:flex" style={{ borderRight: "var(--bw) solid var(--stroke)", background: "var(--surface)" }}>
        <div>
          <div className="px-1"><Wordmark /></div>
          <nav className="mt-8 flex flex-col gap-2">
            {items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={select}
                  className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-bold transition-transform duration-150 active:scale-[0.98]"
                  style={active ? { background: "var(--head)", border: "var(--bw) solid var(--stroke)" } : { color: "var(--muted)" }}
                >
                  <Icon name={it.icon} width={19} weight={active ? "fill" : "regular"} />
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Link
          href="/cabinet"
          onClick={select}
          className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-bold transition-transform duration-150 active:scale-[0.98]"
          style={cabinetActive ? { background: "var(--head)", border: "var(--bw) solid var(--stroke)" } : { color: "var(--muted)" }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full stroke" style={{ background: "#fff" }}>
            <Icon name="user" width={16} />
          </span>
          <span className="flex flex-col leading-tight">
            Кабинет
            <span className="text-[11px] font-medium text-[var(--muted-2)]">{ROLE_LABEL[role]}</span>
          </span>
        </Link>
      </aside>

      {/* Мобайл: верхняя панель */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 @md:hidden" style={{ background: "var(--bg)", borderBottom: "var(--bw) solid var(--stroke)" }}>
        <Wordmark small />
        <Link href="/cabinet" onClick={select} className="flex h-9 w-9 items-center justify-center rounded-full stroke" style={{ background: "#fff" }}>
          <Icon name="user" width={17} />
        </Link>
      </header>

      {/* Контент */}
      <div className="@md:ml-[248px]">
        <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-5 @md:px-9 @md:pb-16 @md:pt-9">{children}</div>
      </div>

      {/* Мобайл: нижние табы — жёлтая пилюля с обводкой, активная иконка в чёрном квадрате */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-1 @md:hidden">
        <nav className="mx-auto flex max-w-md items-center justify-around rounded-[26px] px-2 py-2 stroke" style={{ background: "var(--amber)" }}>
          {tabs.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Link key={it.href} href={it.href} onClick={select} className="flex flex-1 items-center justify-center py-0.5">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-[15px] transition-transform duration-150 active:scale-90"
                  style={active ? { background: "var(--ink)", border: "var(--bw) solid var(--stroke)" } : undefined}
                >
                  <Icon name={it.icon} width={23} weight={active ? "fill" : "bold"} color={active ? "#fff" : "var(--ink)"} />
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
