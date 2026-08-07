"use client";

import { AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { type ReactNode, type UIEvent, useEffect, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { WebLogin } from "@/components/web-login";
import { asset } from "@/lib/asset";
import { APP_NAME, BOT_NAME, CENTER, CENTER_URL, TAGLINE, botDeepLink } from "@/lib/brand";

const BOT_URL = botDeepLink("site");
const EASE = [0.16, 1, 0.3, 1] as const;

const NAV = [
  ["Возможности", "#features"],
  ["Разделы", "#screens"],
  ["Вопросы", "#faq"],
  ["Для кого", "#who"],
] as const;

/** Вкладки над большим экраном: реальные страницы приложения. */
const TABS: { key: string; label: string; icon: IconName; tone: string }[] = [
  { key: "sessions", label: "Сессии", icon: "calendar", tone: "var(--green-soft)" },
  { key: "clients", label: "Клиенты", icon: "users", tone: "var(--purple-soft)" },
  { key: "therapy", label: "Терапия", icon: "pulse", tone: "var(--coral-soft)" },
  { key: "catalog", label: "Каталог", icon: "compass", tone: "var(--amber-soft)" },
  { key: "tools", label: "Инструменты", icon: "spark", tone: "var(--tiffany-soft)" },
];

const TRIO: { mascot: string; title: string; text: string }[] = [
  {
    mascot: "/mascots/fox-great.webp",
    title: "Экономит время",
    text: "Запись, переносы и напоминания уходят из переписки. Вы занимаетесь встречами, а не согласованием времени.",
  },
  {
    mascot: "/mascots/owl-good.webp",
    title: "Приводит клиентов",
    text: "Проверенная анкета попадает в каталог, и люди находят вас по запросу, методу и бюджету — а не по случайному репосту.",
  },
  {
    mascot: "/mascots/panda-good.webp",
    title: "Держит всё под контролем",
    text: "История клиента, домашние задания и динамика состояния собраны в одном месте. К началу сессии вы уже всё помните.",
  },
];

/** С чем приходят: те же фильтры, по которым каталог подбирает специалиста. */
const TOPICS: { icon: IconName; label: string }[] = [
  { icon: "pulse", label: "Тревога" },
  { icon: "clock", label: "Выгорание" },
  { icon: "heart", label: "Отношения" },
  { icon: "user", label: "Самооценка" },
  { icon: "spark", label: "Панические атаки" },
  { icon: "therapy", label: "Травма" },
  { icon: "users", label: "Подростки" },
  { icon: "route", label: "Расставание" },
];

const FEATURES: {
  title: string;
  text: string;
  tags: { icon: IconName; label: string }[];
  shot: string;
  tone: string;
}[] = [
  {
    title: "Клиенты и история",
    text: "Карточка на каждого: контакты, статус, прошлые встречи, заметки, домашние задания и динамика состояния. Ничего не приходится держать в голове и в переписках.",
    tags: [
      { icon: "users", label: "Карточки" },
      { icon: "note", label: "Заметки к встрече" },
      { icon: "chalkboard", label: "Домашние задания" },
      { icon: "chart", label: "Статистика терапии" },
    ],
    shot: "clients",
    tone: "var(--purple-soft)",
  },
  {
    title: "Расписание и записи",
    text: "Вы задаёте рабочие часы по дням недели — дальше клиент сам занимает свободное окно, получает напоминание и переносит встречу, не отвлекая вас.",
    tags: [
      { icon: "calendar", label: "Окна по часам" },
      { icon: "plus", label: "Запись клиента" },
      { icon: "swap", label: "Переносы" },
      { icon: "bell", label: "Напоминания" },
    ],
    shot: "sessions",
    tone: "var(--green-soft)",
  },
  {
    title: "Каталог и подбор",
    text: "Анкета проходит проверку руками и попадает в каталог. Подбор идёт по запросу, методу, формату, городу и бюджету — к вам приходят те, кому вы подходите.",
    tags: [
      { icon: "compass", label: "Анкета с проверкой" },
      { icon: "filter", label: "Фильтры подбора" },
      { icon: "video", label: "Онлайн и очно" },
      { icon: "star", label: "Цена и метод" },
    ],
    shot: "catalog",
    tone: "var(--amber-soft)",
  },
];

const FAQ: { q: string; a: string; icon: IconName }[] = [
  { q: "Нужно что-то устанавливать?", a: "Нет. Приложение открывается внутри Telegram по ссылке, аккаунт мессенджера и есть вход.", icon: "telegram" },
  { q: "А если я работаю с компьютера?", a: "Привяжите почту в кабинете — и заходите в браузере по коду из письма. Данные те же.", icon: "lock" },
  { q: "Что видит клиент?", a: "Свою запись, домашние задания и дневник состояния. Ваши заметки к встрече — только ваши.", icon: "user" },
  { q: "Сколько это стоит?", a: "Основные разделы бесплатны. Платными будут расширенные модули, о них скажем заранее.", icon: "chart" },
  { q: "Как клиенты меня находят?", a: "Через каталог: анкету смотрят руками, дальше подбор по запросу, методу, формату и бюджету.", icon: "compass" },
  { q: "Можно попробовать без клиентов?", a: "Да. Демо работает на тестовых данных прямо в браузере — ничего не сломается.", icon: "spark" },
];

/** Кольцо интеграций: разделы, которые обычно живут в разных приложениях. */
const ORBIT: { icon: IconName; x: number; y: number; size: number }[] = [
  { icon: "calendar", x: 18, y: 62, size: 56 },
  { icon: "users", x: 30, y: 34, size: 52 },
  { icon: "note", x: 50, y: 22, size: 60 },
  { icon: "mood", x: 70, y: 34, size: 52 },
  { icon: "compass", x: 82, y: 62, size: 56 },
  { icon: "bell", x: 10, y: 84, size: 48 },
  { icon: "balance", x: 90, y: 84, size: 48 },
  { icon: "chart", x: 50, y: 52, size: 46 },
];

const WHO: { who: string; icon: IconName; tone: string; points: string[] }[] = [
  {
    who: "Психологу", icon: "therapy", tone: "var(--green-soft)",
    points: [
      "Практика перестаёт жить в блокноте и переписках",
      "Запись, напоминания и переносы — без ручной работы",
      "Видно динамику клиента, а не только последнюю встречу",
      "Проверенная анкета в каталоге приводит новых людей",
    ],
  },
  {
    who: "Клиенту", icon: "heart", tone: "var(--purple-soft)",
    points: [
      "Подобрать специалиста по своему запросу и бюджету",
      "Записаться в свободное окно за пару касаний",
      "Отмечать состояние и видеть, как оно меняется",
      "Практики для трудного момента — бесплатно и без записи",
    ],
  },
];

const MASCOTS: { src: string; className: string; size: number; drift: number; delay: number }[] = [
  { src: "/mascots/fox-great.webp", className: "left-[3%] top-[14%]", size: 156, drift: -80, delay: 0 },
  { src: "/mascots/butterfly-great.webp", className: "right-[4%] top-[9%]", size: 148, drift: -124, delay: 0.5 },
  { src: "/mascots/frog-good.webp", className: "left-[11%] bottom-[6%]", size: 112, drift: -44, delay: 1 },
  { src: "/mascots/panda-good.webp", className: "right-[9%] bottom-[9%]", size: 132, drift: -98, delay: 0.3 },
];

/**
 * Лендинг chronika.space. Живёт порталом в body: демо-обёртка вокруг
 * приложения рисует рамку телефона с `transform`, а внутри трансформированного
 * предка `position: fixed` считается от рамки — лендинг оказывался зажат в
 * телефон со своей полосой прокрутки.
 */
export function WebLanding() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  const page = <LandingPage />;
  return host ? createPortal(page, host) : page;
}

function LandingPage() {
  const [login, setLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Позиция скролла в motion value: иначе параллакс перерисовывал бы страницу
  // на каждом кадре колеса.
  const scrollY = useMotionValue(0);

  return (
    <div
      className="fixed inset-0 z-[95] overflow-y-auto overflow-x-hidden"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
      onScroll={(e: UIEvent<HTMLDivElement>) => {
        const top = e.currentTarget.scrollTop;
        scrollY.set(top);
        setScrolled((was) => (was === top > 16 ? was : top > 16));
      }}
    >
      <Nav scrolled={scrolled} onLogin={() => setLogin(true)} />

      <main>
        <Hero scrollY={scrollY} onLogin={() => setLogin(true)} />
        <ScreensTabs />
        <Trio />
        <Topics />
        <Features />
        <Faq />
        <Orbit />
        <Who />
        <Cta />
      </main>

      <Footer onLogin={() => setLogin(true)} />

      {login && <WebLogin onClose={() => setLogin(false)} />}
    </div>
  );
}

/* ─────────────────────────── общие детали ─────────────────────────── */

/** Чёрная круглая стрелка — та самая кнопка, что держит весь макет. */
function Arrow({ size = 36, bg = "var(--ink)", color = "#fff" }: { size?: number; bg?: string; color?: string }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-0.5"
      style={{ width: size, height: size, background: bg }}
    >
      <svg width={size * 0.36} height={size * 0.36} viewBox="0 0 16 16" fill="none">
        <path d="M5 3l5 5-5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function ArrowLink({ href, children, onClick }: { href?: string; children: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <Arrow />
      <span className="text-[15px] font-semibold">{children}</span>
    </>
  );
  const cls = "group inline-flex items-center gap-3 rounded-full pr-4 transition-opacity duration-200 hover:opacity-70";
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls}>{inner}</a>
  ) : (
    <button onClick={onClick} className={cls}>{inner}</button>
  );
}

function SoftButton({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const cls =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-[15px] font-semibold transition-colors duration-200 hover:bg-[rgba(32,28,24,.11)]";
  const style = { background: "rgba(32,28,24,.07)", color: "var(--ink)" };
  return href ? (
    <a href={href} className={cls} style={style}>{children}</a>
  ) : (
    <button onClick={onClick} className={cls} style={style}>{children}</button>
  );
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const WRAP = "mx-auto w-full max-w-[1200px] px-5 md:px-10";
const FOOT_LINK = "text-[14px] font-medium text-[var(--muted)] transition-opacity hover:opacity-60";

/* ─────────────────────────── шапка ─────────────────────────── */

function Nav({ scrolled, onLogin }: { scrolled: boolean; onLogin: () => void }) {
  return (
    <header
      className="sticky top-0 z-40 transition-all duration-300"
      style={{
        background: scrolled ? "color-mix(in srgb, var(--bg) 82%, transparent)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--hairline)" : "transparent"}`,
      }}
    >
      <div className={`${WRAP} flex h-[80px] items-center justify-between gap-6`}>
        <a href="#top" className="font-tight text-[24px] font-black tracking-[-0.03em]">{APP_NAME}</a>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="text-[15px] font-medium text-[var(--ink)] transition-opacity hover:opacity-60">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onLogin}
            className="rounded-full px-5 py-2.5 text-[14.5px] font-semibold transition-colors hover:bg-[rgba(32,28,24,.11)]"
            style={{ background: "rgba(32,28,24,.07)" }}
          >
            Войти
          </button>
          <a href={BOT_URL} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2.5 pr-1">
            <Arrow size={38} />
            <span className="hidden text-[14.5px] font-semibold sm:block">В Telegram</span>
          </a>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────── герой ─────────────────────────── */

function Hero({ scrollY, onLogin }: { scrollY: MotionValue<number>; onLogin: () => void }) {
  return (
    <section id="top" className="relative overflow-hidden pb-6 pt-16 md:pb-10 md:pt-24">
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        {MASCOTS.map((m) => (
          <Mascot key={m.src} scrollY={scrollY} {...m} />
        ))}
      </div>

      <div className={`${WRAP} relative text-center`}>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="inline-flex items-center gap-2 text-[15px] font-medium text-[var(--muted)]"
        >
          <Icon name="check" width={15} weight="bold" color="var(--green-edge)" />
          Работает прямо в Telegram
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.06, ease: EASE }}
          className="font-tight mx-auto mt-5 max-w-[1020px] text-[42px] font-black leading-[1.05] tracking-[-0.035em] md:text-[68px]"
        >
          Практика психолога,<br className="hidden md:block" /> собранная в одном месте
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.14, ease: EASE }}
          className="mx-auto mt-6 max-w-[620px] text-[17px] font-medium leading-[1.5] text-[var(--muted)] md:text-[19px]"
        >
          Расписание, клиенты, домашние задания и динамика состояния — в одном приложении,
          а не в пяти сервисах и блокноте.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: EASE }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <ArrowLink href={BOT_URL}>Открыть в Telegram</ArrowLink>
          <SoftButton onClick={onLogin}>Войти по почте</SoftButton>
        </motion.div>
      </div>
    </section>
  );
}

function Mascot({
  scrollY, src, className, size, drift, delay,
}: { scrollY: MotionValue<number>; src: string; className: string; size: number; drift: number; delay: number }) {
  const y = useTransform(scrollY, [0, 900], [0, drift]);
  return (
    <motion.div className={`absolute ${className}`} style={{ y }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1, y: [0, -14, 0], rotate: [-4, 4, -4] }}
        transition={{
          opacity: { duration: 0.7, delay: 0.3 + delay, ease: EASE },
          scale: { duration: 0.7, delay: 0.3 + delay, ease: EASE },
          y: { duration: 6 + delay, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 9 + delay, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <Image src={asset(src)} alt="" width={size} height={size} className="select-none" unoptimized />
      </motion.div>
    </motion.div>
  );
}

/* ─────────────── вкладки с большим экраном приложения ─────────────── */

function ScreensTabs() {
  const [active, setActive] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (touched.current) return;
      setActive((i) => (i + 1) % TABS.length);
    }, 4600);
    return () => clearInterval(id);
  }, []);

  const tab = TABS[active];

  return (
    <section id="screens" className="pb-14 md:pb-24">
      <div className={`${WRAP} flex justify-center`}>
        <div className="-mx-5 flex max-w-full gap-1 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((item, i) => (
            <button
              key={item.key}
              onClick={() => {
                touched.current = true;
                setActive(i);
              }}
              className="relative shrink-0 rounded-full px-5 py-3 text-[15px] font-medium whitespace-nowrap transition-colors"
              style={{ color: i === active ? "var(--ink)" : "var(--muted)" }}
            >
              {i === active && (
                <motion.span
                  layoutId="screens-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: "rgba(32,28,24,.07)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-2">
                <Icon name={item.icon} width={17} weight="regular" color="currentColor" />
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={`${WRAP} mt-6 md:mt-8`}>
        <motion.div
          className="relative overflow-hidden rounded-[28px] px-4 pt-4 md:rounded-[36px] md:px-10 md:pt-10"
          animate={{ backgroundColor: tab.tone }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ height: "clamp(280px, 46vw, 620px)" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.key}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="mx-auto h-full w-full max-w-[1040px] overflow-hidden rounded-t-[16px] bg-white md:rounded-t-[22px]"
              style={{ boxShadow: "0 -2px 40px rgba(32,28,24,.12)" }}
            >
              <Image
                src={asset(`/shots/d-${tab.key}.png`)}
                alt={`Экран «${tab.label}» в Хронике`}
                width={2560}
                height={1600}
                className="block w-full"
                unoptimized
                priority={active === 0}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────── три карточки ─────────────────────────── */

function Trio() {
  return (
    <section className={`${WRAP} pb-16 md:pb-28`}>
      <div className="grid gap-4 md:grid-cols-3">
        {TRIO.map((card, i) => (
          <Reveal key={card.title} delay={i * 0.08}>
            <motion.article
              whileHover={{ y: -6 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex h-full flex-col rounded-[26px] bg-[var(--surface)] p-7 md:p-8"
              style={{ border: "1px solid var(--hairline)" }}
            >
              <Image src={asset(card.mascot)} alt="" width={68} height={68} className="select-none" unoptimized />
              <h3 className="font-tight mt-6 text-[25px] font-black leading-tight tracking-[-0.02em]">{card.title}</h3>
              <p className="mt-3 text-[15px] font-medium leading-[1.55] text-[var(--muted)]">{card.text}</p>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── запросы ─────────────────────────── */

function Topics() {
  return (
    <section className={`${WRAP} pb-20 md:pb-32`}>
      <Reveal>
        <p className="text-center text-[19px] font-medium text-[var(--muted)]">
          С чем к психологам приходят чаще всего
        </p>
      </Reveal>
      <div className="mt-12 grid grid-cols-2 gap-y-10 md:grid-cols-4">
        {TOPICS.map((topic, i) => (
          <Reveal key={topic.label} delay={(i % 4) * 0.06}>
            <div className="flex items-center justify-center gap-2.5">
              <Icon name={topic.icon} width={26} weight="regular" color="var(--ink)" />
              <span className="font-tight text-[19px] font-black tracking-[-0.02em] md:text-[22px]">{topic.label}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── возможности ─────────────────────────── */

function Features() {
  return (
    <section id="features" className={`${WRAP} pb-16 md:pb-24`}>
      <Reveal>
        <h2 className="font-tight max-w-[760px] text-[36px] font-black leading-[1.06] tracking-[-0.03em] md:text-[54px]">
          Ведите практику ясно и без хаоса
        </h2>
      </Reveal>

      <div className="mt-10 space-y-4 md:mt-14 md:space-y-5">
        {FEATURES.map((block, i) => (
          <Reveal key={block.title} delay={0.05}>
            <article
              className="grid items-stretch gap-8 overflow-hidden rounded-[30px] p-7 md:grid-cols-2 md:gap-10 md:p-12 md:pr-0"
              style={{ background: "rgba(32,28,24,.045)" }}
            >
              <div className="flex flex-col">
                <h3 className="font-tight text-[28px] font-black leading-[1.08] tracking-[-0.025em] md:text-[40px]">{block.title}</h3>
                <p className="mt-4 max-w-[460px] text-[15px] font-medium leading-[1.55] text-[var(--muted)] md:text-[16.5px]">{block.text}</p>

                <div className="mt-7 flex flex-wrap gap-2.5">
                  {block.tags.map((tag) => (
                    <span
                      key={tag.label}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2.5 text-[14px] font-medium"
                      style={{ border: "1px solid var(--hairline)" }}
                    >
                      <Icon name={tag.icon} width={16} weight="regular" color="var(--ink)" />
                      {tag.label}
                    </span>
                  ))}
                </div>

                <div className="mt-auto pt-9">
                  <ArrowLink href={BOT_URL}>Открыть в Telegram</ArrowLink>
                </div>
              </div>

              <div
                className="relative -mb-7 min-h-[240px] overflow-hidden rounded-[22px] md:-mb-12 md:mr-0 md:min-h-[380px] md:rounded-r-none"
                style={{ background: block.tone }}
              >
                <motion.div
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
                  className="absolute left-6 top-8 w-[130%] overflow-hidden rounded-[14px] bg-white md:left-10 md:top-12"
                  style={{ boxShadow: "0 20px 60px rgba(32,28,24,.16)" }}
                >
                  <Image
                    src={asset(`/shots/d-${block.shot}.png`)}
                    alt={`Экран «${block.title}» в Хронике`}
                    width={2560}
                    height={1600}
                    className="block w-full"
                    unoptimized
                  />
                </motion.div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── вопросы ─────────────────────────── */

function Faq() {
  return (
    <section id="faq" className={`${WRAP} py-16 md:py-28`}>
      <Reveal>
        <h2 className="font-tight mx-auto max-w-[820px] text-center text-[36px] font-black leading-[1.06] tracking-[-0.03em] md:text-[54px]">
          Вопросы, которые задают чаще всего
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3">
        {FAQ.map((item, i) => (
          <Reveal key={item.q} delay={(i % 3) * 0.07} className={i % 3 === 1 ? "md:-translate-y-6" : undefined}>
            <motion.article
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="relative flex h-full min-h-[240px] flex-col rounded-[26px] bg-[var(--surface)] p-7"
              style={{ border: "1px solid var(--hairline)" }}
            >
              <span className="absolute right-6 top-6 font-tight text-[46px] leading-none text-[rgba(32,28,24,.08)]">”</span>
              <p className="max-w-[85%] text-[17px] font-semibold leading-[1.4]">{item.q}</p>
              <p className="mt-4 text-[14.5px] font-medium leading-[1.5] text-[var(--muted)]">{item.a}</p>
              <span className="mt-auto flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(32,28,24,.06)" }}>
                <Icon name={item.icon} width={19} weight="regular" color="var(--ink)" />
              </span>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── кольцо разделов ─────────────────────────── */

function Orbit() {
  return (
    <section className="relative overflow-hidden pt-16 md:pt-24" style={{ background: "rgba(32,28,24,.03)" }}>
      <div className={`${WRAP} text-center`}>
        <Reveal>
          <h2 className="font-tight mx-auto max-w-[760px] text-[36px] font-black leading-[1.06] tracking-[-0.03em] md:text-[54px]">
            Работайте спокойнее: всё в одном месте
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-8 flex justify-center">
            <ArrowLink href={BOT_URL}>Открыть в Telegram</ArrowLink>
          </div>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-12 h-[300px] w-full max-w-[1100px] md:mt-16 md:h-[420px]">
        {[0, 1].map((ring) => (
          <span
            key={ring}
            className="absolute left-1/2 bottom-0 -translate-x-1/2 rounded-t-full"
            style={{
              width: ring === 0 ? "94%" : "64%",
              height: ring === 0 ? "100%" : "68%",
              background: ring === 0 ? "rgba(32,28,24,.035)" : "rgba(32,28,24,.045)",
            }}
          />
        ))}

        {ORBIT.map((chip, i) => (
          <motion.span
            key={chip.icon + i}
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
            className="absolute flex -translate-x-1/2 items-center justify-center rounded-full bg-[var(--surface)]"
            style={{
              left: `${chip.x}%`,
              top: `${chip.y}%`,
              width: chip.size,
              height: chip.size,
              boxShadow: "0 8px 24px rgba(32,28,24,.1)",
            }}
          >
            <Icon name={chip.icon} width={chip.size * 0.42} weight="regular" color="var(--ink)" />
          </motion.span>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: EASE }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[26%]"
        >
          <Image src={asset("/mascots/bee-great.webp")} alt="" width={230} height={230} className="select-none" unoptimized />
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────── для кого ─────────────────────────── */

function Who() {
  return (
    <section id="who" className={`${WRAP} py-16 md:py-28`}>
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-tight max-w-[720px] text-[36px] font-black leading-[1.06] tracking-[-0.03em] md:text-[54px]">
            Две стороны одной встречи.{" "}
            <span className="text-[var(--muted)]">Приложение одно.</span>
          </h2>
          <SoftButton href={BOT_URL}>Посмотреть в Telegram</SoftButton>
        </div>
      </Reveal>

      <div className="mt-10 grid gap-4 md:mt-14 md:grid-cols-2">
        {WHO.map((side, i) => (
          <Reveal key={side.who} delay={i * 0.08}>
            <motion.article
              whileHover={{ y: -6 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="h-full rounded-[28px] p-8 md:p-10"
              style={{ background: side.tone }}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface)]">
                <Icon name={side.icon} width={26} weight="regular" color="var(--ink)" />
              </span>
              <h3 className="font-tight mt-6 text-[30px] font-black tracking-[-0.025em] md:text-[36px]">{side.who}</h3>
              <ul className="mt-6 space-y-3.5">
                {side.points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface)]">
                      <Icon name="check" width={11} weight="bold" color="var(--ink)" />
                    </span>
                    <span className="text-[15px] font-medium leading-[1.5]">{point}</span>
                  </li>
                ))}
              </ul>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── финальный призыв ─────────────────────────── */

function Cta() {
  return (
    <section className="relative overflow-hidden pb-24 pt-32 md:pb-32 md:pt-56">
      <span className="pointer-events-none absolute right-[-6%] top-0 h-[300px] w-[520px] rounded-full" style={{ background: "rgba(32,28,24,.045)" }} />
      <motion.div
        animate={{ y: [0, -16, 0], rotate: [-4, 4, -4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-[16%] top-[6%] hidden lg:block"
      >
        <Image src={asset("/mascots/cat-great.webp")} alt="" width={96} height={96} unoptimized />
      </motion.div>
      <motion.div
        animate={{ y: [0, 14, 0], rotate: [3, -3, 3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute bottom-[10%] right-[14%] hidden lg:block"
      >
        <Image src={asset("/mascots/rabbit-good.webp")} alt="" width={104} height={104} unoptimized />
      </motion.div>

      <div className={`${WRAP} relative text-center`}>
        <Reveal>
          <h2 className="font-tight mx-auto max-w-[820px] text-[40px] font-black leading-[1.05] tracking-[-0.035em] md:text-[64px]">
            Начните вести практику спокойнее
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-5 max-w-[560px] text-[17px] font-medium text-[var(--muted)] md:text-[19px]">
            Открывается в Telegram за одно касание. Ни установки, ни паролей.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <div className="mt-9 flex justify-center">
            <ArrowLink href={BOT_URL}>Начать бесплатно</ArrowLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── подвал ─────────────────────────── */

function Footer({ onLogin }: { onLogin: () => void }) {
  return (
    <footer className={`${WRAP} pb-10`}>
      <div className="rounded-[30px] p-8 md:p-10" style={{ background: "rgba(255,255,255,.7)", border: "1px solid var(--hairline)" }}>
        <div className="flex flex-wrap justify-between gap-10">
          <div className="min-w-[240px] max-w-[320px]">
            <p className="font-tight text-[26px] font-black tracking-[-0.03em]">{APP_NAME}</p>
            <p className="mt-3 text-[14px] font-medium leading-[1.5] text-[var(--muted)]">
              {TAGLINE}. Создано в центре{" "}
              <a href={CENTER_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">{CENTER}</a>.
            </p>
          </div>

          <FooterCol title="Платформа">
            <a href="#features" className={FOOT_LINK}>Возможности</a>
            <a href="#screens" className={FOOT_LINK}>Разделы</a>
            <a href="#who" className={FOOT_LINK}>Для кого</a>
          </FooterCol>

          <FooterCol title="Начать">
            <a href={BOT_URL} target="_blank" rel="noreferrer" className={FOOT_LINK}>Открыть в Telegram</a>
            <button onClick={onLogin} className={`${FOOT_LINK} text-left`}>Войти по почте</button>
            <span className="text-[14px] font-medium text-[var(--muted-2)]">t.me/{BOT_NAME}</span>
          </FooterCol>

          <FooterCol title="Документы">
            <a href="/policy" className={FOOT_LINK}>Политика и условия</a>
            <a href="#faq" className={FOOT_LINK}>Частые вопросы</a>
          </FooterCol>
        </div>

        <p className="mt-10 border-t pt-6 text-[13px] font-medium text-[var(--muted-2)]" style={{ borderColor: "var(--hairline)" }}>
          Платформа не оказывает экстренную и медицинскую помощь.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav className="flex flex-col gap-3">
      <p className="text-[12px] font-bold uppercase tracking-[.12em] text-[var(--muted-2)]">{title}</p>
      {children}
    </nav>
  );
}
