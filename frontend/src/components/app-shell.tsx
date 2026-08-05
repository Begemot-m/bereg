"use client";

import { motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { AuthGate } from "@/components/auth-gate";
import { Icon, type IconName } from "@/components/icons";
import { Onboarding } from "@/components/onboarding";
// Экскурсия по разделам запускается вручную и редко, а лежала в бандле
// каждой страницы приложения — app-shell оборачивает все экраны.
const RoomTour = dynamic(() => import("@/components/room-tour").then((m) => m.RoomTour));
import { APP_NAME } from "@/lib/brand";
import { select } from "@/lib/haptics";
import { useOnboarded } from "@/lib/profile";
import { useAuth } from "@/lib/useAuth";
import { ROLE_LABEL, useRole, type Role } from "@/lib/role";

type NavItem = { href: string; label: string; icon: IconName };

const NAV: Record<Role, NavItem[]> = {
  psychologist: [
    { href: "/", label: "Главная", icon: "home" },
    { href: "/clients", label: "Клиенты", icon: "users" },
    { href: "/sessions", label: "Сессии", icon: "calendar" },
    { href: "/tools", label: "Инструменты", icon: "tools" },
  ],
  client: [
    { href: "/", label: "Главная", icon: "home" },
    { href: "/catalog", label: "Каталог", icon: "compass" },
    { href: "/therapy", label: "Терапия", icon: "therapy" },
    { href: "/tools", label: "Инструменты", icon: "tools" },
  ],
  guest: [
    { href: "/", label: "Главная", icon: "home" },
    { href: "/catalog", label: "Каталог", icon: "compass" },
    { href: "/tools", label: "Инструменты", icon: "tools" },
  ],
};

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function accentFor(pathname: string) {
  if (pathname.startsWith("/therapy/notes") || pathname.startsWith("/clients/notes")) return "tiffany";
  if (pathname.startsWith("/sessions")) return "green";
  if (pathname.startsWith("/therapy")) return "purple";
  if (pathname.startsWith("/clients")) return "purple";
  if (pathname.startsWith("/tools")) return "peach";
  // Каталог и страницы специалистов — единый нежный тиффани.
  if (pathname.startsWith("/catalog")) return "tiffany";
  return "amber";
}

function Wordmark({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[16px] font-black text-[var(--bg)] stroke" style={{ background: "var(--ink)" }}>
        {APP_NAME.charAt(0)}
      </span>
      <span className={`font-tight font-extrabold ${small ? "text-lg" : "text-xl"}`}>{APP_NAME}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { env, state: authState, reason: authReason } = useAuth();
  const [role, setRole] = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const [onboarded] = useOnboarded();
  const [fastEntry, setFastEntry] = useState<boolean | null>(null);
  const items = NAV[role];
  const cabinetActive = pathname.startsWith("/cabinet");
  const accent = accentFor(pathname);
  const tabs: NavItem[] = [...items, { href: "/cabinet", label: "Кабинет", icon: "user" }];
  // Центральная акцентная вкладка: у клиента — терапия, у психолога — сессии.
  const centerHref = role === "psychologist" ? "/sessions" : role === "client" ? "/therapy" : null;
  const centerTone = role === "psychologist" ? "green" : "purple";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const psy = params.get("psy") || params.get("book");
    const invite = params.get("invite");
    const ref = params.get("ref");
    const direct = Boolean(psy || invite || ref);
    if (direct) {
      setRole("client");
      setFastEntry(true);
      if (psy && pathname !== "/catalog") router.replace(`/catalog?psy=${encodeURIComponent(psy)}`);
      if (invite) sessionStorage.setItem("bereg_pending_invite", invite);
      if (ref) sessionStorage.setItem("bereg_pending_ref", ref);
    } else {
      setFastEntry(false);
    }
    const finish = () => {
      setFastEntry(false);
      window.history.replaceState({}, "", window.location.pathname);
    };
    window.addEventListener("bereg-fast-entry-complete", finish);
    return () => window.removeEventListener("bereg-fast-entry-complete", finish);
  }, [pathname, router, setRole]);

  // Обучение запускается вручную — из баннера на главной или из кабинета.
  const [tourActive, setTourActive] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardButtonTop, setKeyboardButtonTop] = useState(0);
  useEffect(() => {
    const start = () => setTourActive(true);
    window.addEventListener("bereg:tour-start", start);
    return () => window.removeEventListener("bereg:tour-start", start);
  }, []);

  useEffect(() => {
    let blurTimer = 0;
    const isTextField = (element: Element | null) => {
      if (element instanceof HTMLTextAreaElement) return true;
      if (element instanceof HTMLElement && element.isContentEditable) return true;
      if (!(element instanceof HTMLInputElement)) return false;
      return !["button", "checkbox", "color", "file", "hidden", "radio", "range", "reset", "submit"].includes(element.type);
    };
    const update = () => {
      const open = isTextField(document.activeElement);
      const viewport = window.visualViewport;
      setKeyboardOpen(open);
      setKeyboardButtonTop(Math.max(12, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 42));
      document.documentElement.toggleAttribute("data-keyboard-open", open);
    };
    const onFocusIn = () => { window.clearTimeout(blurTimer); update(); };
    const onFocusOut = () => { window.clearTimeout(blurTimer); blurTimer = window.setTimeout(update, 80); };
    // Как в системных приложениях iOS: клавиатура уходит по тапу вне поля
    // и по протяжке страницы, а не только по кнопке «Готово».
    const dismiss = () => { const active = document.activeElement; if (isTextField(active)) (active as HTMLElement).blur(); };
    const insideField = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("input, textarea, [contenteditable=true], label, [role=switch]"));
    const onPointerDown = (event: PointerEvent) => { if (!insideField(event.target)) dismiss(); };
    let startY = 0;
    const onTouchStart = (event: TouchEvent) => { startY = event.touches[0]?.clientY ?? 0; };
    const onTouchMove = (event: TouchEvent) => {
      if (insideField(event.target)) return;
      if (Math.abs((event.touches[0]?.clientY ?? 0) - startY) > 24) dismiss();
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.clearTimeout(blurTimer);
      document.documentElement.removeAttribute("data-keyboard-open");
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  // Пока идёт вход, приложение не показываем: иначе экраны успевают отправить
  // запросы без токена, получить 401 и остаться в бесконечной загрузке.
  if (authState === "loading" || onboarded === null || fastEntry === null) return <div className="min-h-[100dvh]" style={{ background: "var(--bg)" }} />;
  if (authState === "anon") return <AuthGate env={env} reason={authReason} />;
  if (!onboarded && !fastEntry) return <Onboarding />;

  return (
    <div data-accent={accent} className="@container fixed inset-0 overflow-hidden" style={{ background: "var(--page)" }}>
      {/* Обучение с прожекторной подсветкой — поверх всего, по запуску из баннера */}
      {tourActive && <RoomTour role={role} onDone={() => setTourActive(false)} />}
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
                  className="flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-sm font-bold transition-transform duration-150 active:scale-[0.98]"
                  style={active ? { background: "var(--head)", border: "var(--bw) solid var(--edge)" } : { color: "var(--muted)" }}
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
          className="flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-sm font-bold transition-transform duration-150 active:scale-[0.98]"
          style={cabinetActive ? { background: "var(--head)", border: "var(--bw) solid var(--edge)" } : { color: "var(--muted)" }}
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

      {/* Колонка приложения: скроллится только контент; меню закреплено. */}
      <div className="relative flex h-full flex-col @md:ml-[248px]">
        {/* Мобайл: верхней панели нет — она мешала в Telegram (тянулась при скролле). */}

        {/* Контент — единственная прокручиваемая область (отступы под чёлку и меню) */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-3xl px-4 pb-[104px] pt-[var(--top-pad)] @md:px-9 @md:pb-16 @md:pt-9">{children}</div>
        </div>

        {/* Мобайл: нижние табы — плашка с обводкой; вокруг неё прозрачно (без заливки-полосы) */}
        {!keyboardOpen && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[calc(var(--safe-bottom)+12px)] @md:hidden">
          <nav className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-[27px] bg-white/90 px-3 py-2 backdrop-blur-md" style={{ border: "var(--bw) solid rgba(32,28,24,.12)", boxShadow: "0 12px 30px -16px rgba(32,28,24,.4)" }}>
            {tabs.map((it) => {
              const active = isActive(pathname, it.href);
              // Центральная вкладка — приподнятая акцентная кнопка.
              if (it.href === centerHref) return (
                <Link key={it.href} href={it.href} onClick={select} data-tour={`nav-${it.href.slice(1)}`} className="relative z-[2] flex flex-1 items-center justify-center" aria-label={it.label}>
                  <motion.span whileTap={{ scale: 0.9 }} className="-mt-7 flex h-14 w-14 items-center justify-center rounded-[18px]" style={{ background: active ? "var(--ink)" : `var(--${centerTone})`, border: `var(--bw-lg) solid ${active ? "var(--ink)" : `var(--${centerTone}-edge)`}`, boxShadow: `0 10px 20px -8px ${active ? "rgba(32,28,24,.5)" : `var(--${centerTone}-edge)`}` }}>
                    <Icon name={it.icon} width={26} weight="fill" color={active ? "#fff" : "var(--ink)"} />
                  </motion.span>
                </Link>
              );
              return (
                <Link key={it.href} href={it.href} onClick={select} data-tour={`nav-${it.href === "/" ? "home" : it.href.slice(1)}`} className="relative z-[1] flex flex-1 items-center justify-center py-1.5">
                  <span className="relative flex h-9 w-9 items-center justify-center">
                    {active && <motion.span layoutId="navActive" className="absolute inset-0 rounded-full" style={{ background: "var(--head-soft)" }} transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <motion.span whileTap={{ scale: 0.82 }} className="relative z-[1] flex items-center justify-center">
                      <Icon name={it.icon} width={22} weight={active ? "fill" : "regular"} color={active ? "var(--edge)" : "var(--ink)"} />
                    </motion.span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>}
        {keyboardOpen && (
          <button
            type="button"
            onPointerDown={(event) => { event.preventDefault(); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }}
            className="btn btn-accent fixed right-3 z-50 px-3 py-1.5 text-[11px] @md:hidden"
            style={{ top: keyboardButtonTop }}
            aria-label="Свернуть клавиатуру"
          >Готово</button>
        )}
      </div>
    </div>
  );
}
