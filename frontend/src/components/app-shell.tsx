"use client";

import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { AuthGate } from "@/components/auth-gate";
import { Icon, type IconName } from "@/components/icons";
import { LoadingBar } from "@/components/loading-bar";
import { Onboarding } from "@/components/onboarding";
import { startParam, target } from "@/components/start-route";
// Экскурсия по разделам запускается вручную и редко, а лежала в бандле
// каждой страницы приложения — app-shell оборачивает все экраны.
const RoomTour = dynamic(() => import("@/components/room-tour").then((m) => m.RoomTour));
// Лендинг видят только гости из браузера — в бандл вошедшего он не нужен.
const WebLanding = dynamic(() => import("@/components/web-landing").then((m) => m.WebLanding));
// Экран приглашения видят только те, кто пришёл по ссылке специалиста.
const InviteWelcome = dynamic(() => import("@/components/invite-welcome").then((m) => m.InviteWelcome));
import { serverMessage } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";
import { joinClientCard } from "@/lib/clients";
import { acceptPsyInvite, readInvitePayload, type InviteKind } from "@/lib/invite";
import { select } from "@/lib/haptics";
import { iconLoop } from "@/lib/icon-motion";
import { useMe } from "@/lib/me";
import { useOnboarded } from "@/lib/profile";
import { useAuth } from "@/lib/useAuth";
import { getRole, ROLE_LABEL, useRole, type Role } from "@/lib/role";
import { trackSection } from "@/lib/track";

type NavItem = { href: string; label: string; icon: IconName };

/**
 * Иконка навигации: при активации проигрывает трюк своего раздела — дом
 * подпрыгивает, календарь перелистывается, компас делает круг. `key` завязан
 * на состояние, поэтому кадры идут заново на каждом переходе, а не один раз
 * при монтировании. Неактивная иконка стоит смирно: постоянное шевеление в
 * меню — визуальный шум.
 */
function NavIcon({ icon, active, size, weight, color }: { icon: IconName; active: boolean; size: number; weight?: "regular" | "bold" | "fill"; color?: string }) {
  const reduce = useReducedMotion();
  const glyph = <Icon name={icon} width={size} weight={weight} color={color} />;
  if (reduce) return glyph;
  return (
    // Перспектива нужна повороту календаря: без неё rotateY выглядит сжатием.
    <span className="flex items-center justify-center" style={{ perspective: 520 }}>
      <motion.span
        key={active ? "on" : "off"}
        className="flex items-center justify-center"
        style={{ willChange: "transform", backfaceVisibility: "hidden", transformStyle: "preserve-3d" }}
        animate={active ? iconLoop(icon).animate : { scale: 1, rotate: 0, y: 0 }}
        transition={active
          ? { duration: iconLoop(icon).duration, ease: "easeInOut", repeat: Infinity, repeatType: "loop" }
          : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {glyph}
      </motion.span>
    </span>
  );
}

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

/**
 * Специалист открыл собственную ссылку приглашения. Ничего не привязалось —
 * говорим об этом прямо, иначе выглядит как молчаливый сбой.
 */
// Ссылка не сработала: своя же (специалист проверяет, как она открывается) или
// просроченная — приглашение действует месяц с отправки.
const INVITE_NOTES = {
  self: {
    title: "Это ваша ссылка приглашения",
    text: "Вы открыли её со своего аккаунта, поэтому ничего не изменилось: карточка клиента не создана, вы остались специалистом. Ссылка сработает у того, кому вы её отправили, — он откроет её под своим Telegram и появится у вас в «Клиентах».",
  },
  expired: {
    title: "Приглашение больше не действует",
    text: "Ссылка выдаётся на месяц. Попросите специалиста прислать её ещё раз — тогда карточка подключится к вашему аккаунту. Приложением можно пользоваться и без этого: специалиста легко найти в каталоге.",
  },
} as const;

function InviteNote({ kind, onClose }: { kind: keyof typeof INVITE_NOTES; onClose: () => void }) {
  const note = INVITE_NOTES[kind];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[var(--r-block)] p-5"
        style={{ background: "var(--surface)" }}
      >
        <span className="ico h-11 w-11"><Icon name={kind === "self" ? "share" : "clock"} width={22} weight="fill" color="var(--ink)" /></span>
        <h3 className="font-tight mt-3 text-[19px] font-black leading-tight">{note.title}</h3>
        <p className="t-sub mt-1.5">{note.text}</p>
        <button onClick={onClose} className="btn mt-4 w-full py-3.5 text-[15px]">Понятно</button>
      </motion.div>
    </motion.div>
  );
}

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
  const { env, state: authState, reason: authReason, detail: authDetail } = useAuth();
  const qc = useQueryClient();
  // Профиль читается на уровне оболочки, а не только в кабинете: из него
  // приезжает роль, и до этого запроса интерфейс собирался клиентским даже у
  // психолога, впервые открывшего приложение на другом устройстве.
  useMe();
  const [role, setRole] = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const [onboarded] = useOnboarded();
  const [fastEntry, setFastEntry] = useState<boolean | null>(null);
  // Пришли по ссылке специалиста: показать, кто позвал, и только потом знакомство.
  const [invite, setInvite] = useState<{ kind: InviteKind; token: string } | null>(null);
  const [greeted, setGreeted] = useState(false);
  // Ссылка не сработала: своя же или просроченная — объясняем, что произошло.
  const [inviteNote, setInviteNote] = useState<keyof typeof INVITE_NOTES | null>(null);
  // Пришли по ссылке на запись: знакомство всё равно обязательно, но роль
  // спрашивать незачем — человека позвали как клиента.
  const [entryRole, setEntryRole] = useState<Role | null>(null);
  const items = NAV[role];
  const cabinetActive = pathname.startsWith("/cabinet");
  const accent = accentFor(pathname);

  // Посещаемость: раздел отмечается на каждом переходе, не чаще раза в пять
  // минут на раздел. Сводку читает админка.
  useEffect(() => { trackSection(pathname); }, [pathname]);

  // Приглашение принимается, как только появилась сессия: до этого метку
  // некуда предъявить. Раньше она просто лежала в sessionStorage, карточка у
  // психолога навсегда оставалась в «Ждём подключения», и терапия клиента до
  // неё не доезжала.
  useEffect(() => {
    if (authState !== "authed") return;
    // Специалист открыл собственную ссылку (проверить, как она выглядит):
    // сервер отвечает `self`, привязки не происходит. Возвращаем его в свою
    // роль — до ответа оболочка могла увести его в клиентскую — и объясняем,
    // что по ссылке подключается клиент, а не он сам.
    const onSelf = (e: unknown) => {
      const err = serverMessage(e);
      // Просроченная ссылка: человек ничего не сделал не так, но и молчать
      // нельзя — иначе он ждёт, что специалист «увидит» его в приложении.
      if (err === "expired") {
        setInvite(null);
        setInviteNote("expired");
        return;
      }
      if (err !== "self") return;
      setRole("psychologist");
      setInvite(null);
      setInviteNote("self");
    };

    const token = sessionStorage.getItem("bereg_pending_invite");
    if (token) {
      sessionStorage.removeItem("bereg_pending_invite");
      joinClientCard(token)
        .then(() => { qc.invalidateQueries(); })
        .catch(onSelf /* просроченное или чужое приглашение — молча пропускаем */);
    }
    // Общая ссылка специалиста: карточки ещё нет, её заводит сам переход.
    const psyToken = sessionStorage.getItem("bereg_pending_psy");
    if (psyToken) {
      sessionStorage.removeItem("bereg_pending_psy");
      acceptPsyInvite(psyToken)
        .then(() => { qc.invalidateQueries(); })
        .catch(onSelf /* лимит мест или неподтверждённая анкета — человека это не касается */);
    }
    // invite в зависимостях не для красоты: разбор ссылки живёт в соседнем
    // эффекте, и когда вход успевал пройти раньше него, метка ложилась в
    // sessionStorage уже после этой проверки — специалист так и не цеплялся.
  }, [authState, invite, qc, setRole]);
  const tabs: NavItem[] = [...items, { href: "/cabinet", label: "Кабинет", icon: "user" }];
  // Центральная акцентная вкладка: у клиента — терапия, у психолога — сессии.
  const centerHref = role === "psychologist" ? "/sessions" : role === "client" ? "/therapy" : null;
  const centerTone = role === "psychologist" ? "green" : "purple";

  // Разбор ссылки-приглашения — ровно один раз за сеанс. С зависимостью от
  // pathname этот эффект перезапускался на каждом переходе между разделами и
  // каждый раз крутил трёхсекундный поллинг startParam — отсюда и ощущение,
  // что разделы открываются долго.
  const navRef = useRef({ pathname, router, setRole });
  navRef.current = { pathname, router, setRole };
  useEffect(() => {
    let stopped = false;
    const { router, setRole } = navRef.current;
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    const ref = params.get("ref");
    if (ref) sessionStorage.setItem("bereg_pending_ref", ref);

    const enter = (psy: string | null) => {
      setRole("client");
      setFastEntry(true);
      if (psy) setEntryRole("client");
      if (psy && navRef.current.pathname !== "/catalog") router.replace(`/catalog?psy=${encodeURIComponent(psy)}&book=1`);
    };

    // Пришли по приглашению специалиста: сначала экран «вас пригласили», потом
    // знакомство в роли клиента. Быстрый вход (fastEntry) тут не годится — он
    // проносит человека мимо и того и другого прямо в приложение.
    // Роль специалиста тут не трогаем: по ссылке чаще всего проходит он сам,
    // проверяя, что она открывается, — и до ответа сервера успевал оказаться в
    // клиентском интерфейсе. Клиенту роль по-прежнему ставим сразу: на ней
    // держатся экран приглашения и знакомство.
    const greet = (kind: InviteKind, token: string) => {
      sessionStorage.setItem(kind === "psy" ? "bereg_pending_psy" : "bereg_pending_invite", token);
      if (getRole() !== "psychologist") setRole("client");
      setInvite({ kind, token });
      setFastEntry(false);
    };

    const psy = params.get("psy") || params.get("book");
    if (invite) {
      // Ссылка старого образца — сразу на сайт, с подписанным токеном карточки.
      greet("card", invite);
    } else if (psy || ref) {
      enter(psy);
    } else {
      // Метка из ссылки-приглашения приходит от скрипта Telegram, а он
      // подключается уже после гидрации. Не дождавшись, мы отправляли нового
      // человека в онбординг вместо экрана записи.
      let tries = 0;
      const poll = () => {
        if (stopped) return;
        const payload = startParam();
        // Приглашение в боте — та же метка, что и запись, только с приставкой
        // psy_ или inv_. Разбираем её до target(), иначе человек уедет в
        // каталог мимо экрана приглашения.
        const asInvite = payload ? readInvitePayload(payload) : null;
        if (asInvite) {
          greet(asInvite.kind, asInvite.token);
          return;
        }
        // Приглашение друга: код тот же, что в `?ref=`, только приехал меткой
        // из бота — без этой ветки он терялся по дороге.
        const asRef = payload ? /^ref_(.+)$/.exec(payload) : null;
        if (asRef) {
          sessionStorage.setItem("bereg_pending_ref", asRef[1]);
          enter(null);
          return;
        }
        const href = payload ? target(payload) : null;
        if (href) {
          const id = new URLSearchParams(href.split("?")[1]).get("psy");
          enter(id);
          return;
        }
        // Пока это не решится, на экране пусто (см. проверку fastEntry === null
        // ниже). Шаг в 150 мс держал заставку до трёх секунд у всех, кто зашёл
        // обычным способом; 40 мс укладываются в те же попытки за ~1 секунду.
        if (payload || tries++ >= 24) { setFastEntry(false); return; }
        window.setTimeout(poll, 40);
      };
      poll();
    }
    const finish = () => {
      setFastEntry(false);
      window.history.replaceState({}, "", window.location.pathname);
    };
    window.addEventListener("bereg-fast-entry-complete", finish);
    return () => {
      stopped = true;
      window.removeEventListener("bereg-fast-entry-complete", finish);
    };
  }, []);

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
  // Человек пришёл по ссылке-приглашению на запись — он ещё никто и звать
  // никак. Показать ему замок вместо расписания значит потерять клиента:
  // пускаем смотреть окна, вход попросим на самой записи.
  // Из браузера входа пока нет, но пустой замок ничего не объясняет: показываем
  // лендинг с кнопкой в бота. Замок остаётся для сбоев входа внутри Telegram.
  if (authState === "anon" && !fastEntry) {
    return env === "desktop"
      ? <WebLanding />
      : <AuthGate env={env} reason={authReason} detail={authDetail} />;
  }
  // Экран приглашения — только новичкам: тому, кто уже пользуется приложением,
  // достаточно того, что специалист молча появился в «Терапии».
  if (invite && !greeted && !onboarded) {
    return <InviteWelcome token={invite.token} kind={invite.kind} onStart={() => setGreeted(true)} />;
  }
  // Знакомство обязательно: на его последнем шаге даётся согласие на обработку
  // данных, без которого пользоваться платформой нельзя. Быстрый вход по ссылке
  // на запись больше мимо не проносит — он только пускает посмотреть окна тому,
  // кто ещё не вошёл в аккаунт.
  if (!onboarded && (authState === "authed" || !fastEntry)) {
    return <Onboarding startRole={invite ? "client" : entryRole ?? undefined} />;
  }

  return (
    <div data-accent={accent} className="@container fixed inset-0 overflow-hidden" style={{ background: "var(--page)" }}>
      {/* Обучение с прожекторной подсветкой — поверх всего, по запуску из баннера */}
      {tourActive && <RoomTour role={role} onDone={() => setTourActive(false)} />}
      {inviteNote && <InviteNote kind={inviteNote} onClose={() => setInviteNote(null)} />}
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
                  data-tour={`nav-${it.href === "/" ? "home" : it.href.slice(1)}`}
                  className="flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-sm font-bold transition-transform duration-150 active:scale-[0.98]"
                  style={active ? { background: "var(--head)", border: "var(--bw) solid var(--edge)" } : { color: "var(--muted)" }}
                >
                  <NavIcon icon={it.icon} active={active} size={19} weight="regular" />
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Link
          href="/cabinet"
          onClick={select}
          data-tour="nav-cabinet"
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
        <LoadingBar />
        {/* Мобайл: верхней панели нет — она мешала в Telegram (тянулась при скролле). */}

        {/* Контент — единственная прокручиваемая область (отступы под чёлку и меню) */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-3xl px-4 pb-[104px] pt-[var(--top-pad)] @md:px-9 @md:pb-16 @md:pt-9">{children}</div>
        </div>

        {/* Мобайл: нижние табы — плашка с обводкой; вокруг неё прозрачно (без заливки-полосы) */}
        {!keyboardOpen && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[calc(var(--safe-bottom)+12px)] @md:hidden">
          {/* Без backdrop-blur: панель висит над прокруткой, и размытие
              заставляло вебвью перерисовывать область под ней на каждом кадре. */}
          <nav className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-[27px] bg-white px-3 py-2" style={{ border: "var(--bw) solid rgba(32,28,24,.12)", boxShadow: "0 12px 30px -16px rgba(32,28,24,.4)" }}>
            {tabs.map((it) => {
              const active = isActive(pathname, it.href);
              // Центральная вкладка — приподнятая акцентная кнопка.
              if (it.href === centerHref) return (
                <Link key={it.href} href={it.href} onClick={select} data-tour={`nav-${it.href.slice(1)}`} className="relative z-[2] flex flex-1 items-center justify-center" aria-label={it.label}>
                  <motion.span whileTap={{ scale: 0.9 }} className="-mt-7 flex h-14 w-14 items-center justify-center rounded-[18px]" style={{ background: active ? "var(--ink)" : `var(--${centerTone})`, border: `var(--bw-lg) solid ${active ? "var(--ink)" : `var(--${centerTone}-edge)`}`, boxShadow: `0 10px 20px -8px ${active ? "rgba(32,28,24,.5)" : `var(--${centerTone}-edge)`}` }}>
                    {/* В нижнем меню иконки не двигаются: трюки читались как
                        рябь под пальцем, а не как отклик. */}
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
