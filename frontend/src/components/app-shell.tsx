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
const accentFor = (pathname: string) => (pathname.startsWith("/sessions") || pathname.startsWith("/catalog") ? "sage" : "iris");

function Wordmark({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[15px] font-black text-white" style={{ background: "var(--a1)" }}>
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

  if (onboarded === null) return <div className="min-h-[100dvh]" style={{ background: "var(--bg)" }} />;
  if (!onboarded) return <Onboarding />;

  return (
    <div data-accent={accent} className="@container min-h-[100dvh]">
      {/* Десктоп: сайдбар */}
      <aside
        className="fixed left-0 top-0 z-30 hidden h-full w-[248px] flex-col justify-between px-4 py-6 @md:flex"
        style={{ borderRight: "1px solid var(--hairline)", background: "var(--surface)" }}
      >
        <div>
          <div className="px-2"><Wordmark /></div>
          <nav className="mt-8 flex flex-col gap-1">
            {items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={select}
                  className="relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200"
                  style={{ color: active ? "#fff" : "var(--muted)" }}
                >
                  {active && <span className="absolute inset-0 rounded-2xl" style={{ background: "var(--a1)" }} />}
                  <span className="relative flex items-center gap-3">
                    <Icon name={it.icon} width={19} weight={active ? "fill" : "regular"} />
                    {it.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
        <Link
          href="/cabinet"
          onClick={select}
          className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200"
          style={{ color: cabinetActive ? "var(--ink)" : "var(--muted)", background: cabinetActive ? "var(--surface-2)" : "transparent" }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--a-tint)" }}>
            <Icon name="user" width={15} color="var(--a1)" />
          </span>
          <span className="flex flex-col leading-tight">
            Кабинет
            <span className="text-[11px] font-normal text-[var(--muted-2)]">{ROLE_LABEL[role]}</span>
          </span>
        </Link>
      </aside>

      {/* Мобайл: верхняя панель */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 @md:hidden"
        style={{ borderBottom: "1px solid var(--hairline)", background: "color-mix(in srgb, var(--bg) 86%, transparent)", backdropFilter: "blur(12px)" }}
      >
        <Wordmark small />
        <Link href="/cabinet" onClick={select} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-2)]">
          <Icon name="user" width={17} />
        </Link>
      </header>

      {/* Контент */}
      <div className="@md:ml-[248px]">
        <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 @md:px-9 @md:pb-16 @md:pt-9">{children}</div>
      </div>

      {/* Мобайл: нижние табы. Пилюля строго вокруг иконки, подпись отдельно. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1.5 @md:hidden"
        style={{ borderTop: "1px solid var(--hairline)", background: "color-mix(in srgb, var(--bg) 92%, transparent)", backdropFilter: "blur(14px)" }}
      >
        {[...items, { href: "/cabinet", label: "Кабинет", icon: "user" as IconName }].map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link key={it.href} href={it.href} onClick={select} className="flex flex-1 flex-col items-center gap-1 py-0.5">
              <span className="relative flex h-8 w-14 items-center justify-center">
                {active && <span className="absolute inset-0 rounded-full transition-colors" style={{ background: "var(--a1)" }} />}
                <span className="relative">
                  <Icon name={it.icon} width={21} weight={active ? "fill" : "regular"} color={active ? "#fff" : "var(--muted-2)"} />
                </span>
              </span>
              <span className="text-[10px] font-bold leading-none" style={{ color: active ? "var(--a1-ink)" : "var(--muted-2)" }}>{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
