"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Onboarding } from "@/components/onboarding";
import { APP_NAME } from "@/lib/brand";
import { select } from "@/lib/haptics";
import { displayPhoto, useOnboarded } from "@/lib/profile";
import { ROLE_LABEL, useRole, type Role } from "@/lib/role";

// Круглая кнопка кабинета с аватаркой из Telegram (если есть).
function AvatarLink({ size = 36 }: { size?: number }) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => setPhoto(displayPhoto()), []);
  return (
    <Link href="/cabinet" onClick={select} className="flex shrink-0 items-center justify-center overflow-hidden rounded-full stroke" style={{ width: size, height: size, background: "var(--head-soft)" }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon name="user" width={Math.round(size * 0.48)} weight="regular" />
      )}
    </Link>
  );
}

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
    { href: "/therapy", label: "Терапия", icon: "therapy" },
    { href: "/tools", label: "Инструменты", icon: "tools" },
    { href: "/catalog", label: "Каталог", icon: "compass" },
  ],
  guest: [
    { href: "/", label: "Главная", icon: "home" },
    { href: "/sessions", label: "Сессии", icon: "calendar" },
    { href: "/tools", label: "Инструменты", icon: "tools" },
    { href: "/catalog", label: "Каталог", icon: "compass" },
  ],
};

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function accentFor(pathname: string) {
  if (pathname.startsWith("/sessions")) return "green";
  if (pathname.startsWith("/therapy")) return "purple";
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
  const activeIndex = tabs.findIndex((t) => isActive(pathname, t.href));

  if (onboarded === null) return <div className="min-h-[100dvh]" style={{ background: "var(--bg)" }} />;
  if (!onboarded) return <Onboarding />;

  return (
    <div data-accent={accent} className="@container min-h-[100dvh]" style={{ background: "var(--page)" }}>
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
                  <Icon name={it.icon} width={19} weight="regular" />
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

      {/* Мобайл: верхняя панель — sticky, ровно держится сверху и не дёргается при скролле */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 @md:hidden" style={{ background: "var(--page)", transition: "background-color .5s ease" }}>
        <Wordmark small />
        <AvatarLink />
      </header>

      {/* Контент */}
      <div className="@md:ml-[248px]">
        <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-2 @md:px-9 @md:pb-16 @md:pt-9">{children}</div>
      </div>

      {/* Мобайл: нижние табы — жёлтая пилюля с обводкой, активная иконка в чёрном квадрате */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-1 @md:hidden">
        <nav className="mx-auto max-w-md rounded-[26px] px-2 py-2" style={{ background: "var(--nav)", border: "var(--bw-lg) solid var(--nav-edge)" }}>
          <div className="relative flex">
            {activeIndex >= 0 && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute top-0 flex h-full items-center justify-center"
                style={{ width: `${100 / tabs.length}%` }}
                initial={false}
                animate={{ left: `${(activeIndex * 100) / tabs.length}%` }}
                transition={{ type: "spring", stiffness: 520, damping: 30 }}
              >
                <span className="h-11 w-11 rounded-full" style={{ background: "var(--page)", border: "var(--bw) solid var(--nav-edge)" }} />
              </motion.div>
            )}
            {tabs.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <Link key={it.href} href={it.href} onClick={select} className="relative z-[1] flex flex-1 items-center justify-center py-0.5">
                  <span className="flex h-11 w-11 items-center justify-center transition-transform duration-150 active:scale-90">
                    <Icon name={it.icon} width={22} weight={active ? "fill" : "regular"} color="var(--ink)" />
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
