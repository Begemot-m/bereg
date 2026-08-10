"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import Image from "next/image";
import { createPortal } from "react-dom";

import { LEGAL, LEGAL_DOCS } from "@/lib/legal";
import {
  createContext,
  type ReactNode,
  type RefObject,
  type UIEvent,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { Icon, type IconName } from "@/components/icons";
import { WebLogin } from "@/components/web-login";
import { asset } from "@/lib/asset";
import { APP_NAME, BOT_NAME, CENTER, CENTER_URL, TAGLINE, botDeepLink } from "@/lib/brand";

const BOT_URL = botDeepLink("site");
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Лендинг прокручивается не окном, а своим контейнером. Анимациям, привязанным
 * к скроллу, нужно отдать именно его — иначе прогресс всегда остаётся нулевым.
 */
const ScrollBox = createContext<RefObject<HTMLDivElement | null> | null>(null);

/** Стек и параллакс включаются только с планшета: на телефоне блок выше экрана. */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

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

const TRIO: { icon: IconName; tone: string; edge: string; title: string; text: string }[] = [
  {
    icon: "clock",
    tone: "var(--green-soft)",
    edge: "var(--green-edge)",
    title: "Экономия времени и комфорт",
    text: "Удобная система управления окнами записи позволит эффективно управлять временем и сократит согласование встреч с клиентами.",
  },
  {
    icon: "seal",
    tone: "var(--purple-soft)",
    edge: "var(--purple-edge)",
    title: "Честный каталог",
    text: "В отличие от других сервисов, платформа делает систему ранжирования прозрачной: реальные отзывы только от тех людей, с кем вы работали, рейтинг не покупается.",
  },
  {
    icon: "pulse",
    tone: "var(--coral-soft)",
    edge: "var(--coral-edge)",
    title: "Полная цифровизация терапии",
    text: "История встреч, домашние задания и отслеживание динамики состояния и настроения клиента — всё собрано в одном месте. Это позволит усилить вашу практику.",
  },
];

/** С чем приходят: те же фильтры, по которым каталог подбирает специалиста. */
const TOPICS: { icon: IconName; label: string; color: string }[] = [
  { icon: "storm", label: "Тревога", color: "var(--purple-edge)" },
  { icon: "battery", label: "Выгорание", color: "var(--amber-edge)" },
  { icon: "heart", label: "Отношения", color: "var(--coral-edge)" },
  { icon: "self", label: "Самооценка", color: "var(--tiffany-edge)" },
  { icon: "heartbeat", label: "Панические атаки", color: "var(--coral-edge)" },
  { icon: "bandaid", label: "Травма", color: "var(--green-edge)" },
  { icon: "backpack", label: "Подростки", color: "var(--amber-edge)" },
  { icon: "heartbreak", label: "Расставание", color: "var(--purple-edge)" },
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
    text: "Анкета проходит ручную проверку и попадает в каталог. Подбор идёт по персональному фильтру, поэтому к вам приходят те, кому вы подходите. Без накруток отзывов и платного рейтинга.",
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
const ORBIT: IconName[] = ["calendar", "users", "note", "mood", "compass", "bell", "balance", "chart"];

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
      "Инструменты для самостоятельной работы вне терапии",
    ],
  },
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
  const boxRef = useRef<HTMLDivElement>(null);

  return (
    <ScrollBox.Provider value={boxRef}>
      <div
        ref={boxRef}
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
          <Hero scrollY={scrollY} />
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
    </ScrollBox.Provider>
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
  const cls =
    "group inline-flex cursor-pointer items-center gap-3 rounded-full pr-4 transition-opacity duration-200 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]";
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls}>{inner}</a>
  ) : (
    <button onClick={onClick} className={cls}>{inner}</button>
  );
}

function SoftButton({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const cls =
    "inline-flex cursor-pointer items-center justify-center rounded-full px-6 py-3 text-[15px] font-semibold transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-[rgba(32,28,24,.13)] active:translate-y-0";
  const style = { background: "rgba(32,28,24,.07)", color: "var(--ink)" };
  return href ? (
    <a href={href} className={cls} style={style}>{children}</a>
  ) : (
    <button onClick={onClick} className={cls} style={style}>{children}</button>
  );
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const calm = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={calm ? { opacity: 0 } : { opacity: 0, y: 26, filter: "blur(10px)" }}
      whileInView={calm ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const WRAP = "mx-auto w-full max-w-[1200px] px-5 md:px-10";
const FOOT_LINK =
  "cursor-pointer text-[14px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)] hover:underline hover:underline-offset-4";

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
      <div className={`${WRAP} flex h-[68px] items-center justify-between gap-4 md:h-[80px] md:gap-6`}>
        <a href="#top" className="font-tight text-[24px] font-black tracking-[-0.03em]">{APP_NAME}</a>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="cursor-pointer text-[15px] font-medium text-[var(--ink)] transition-opacity hover:opacity-55">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onLogin}
            className="cursor-pointer rounded-full px-5 py-2.5 text-[14.5px] font-semibold transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[rgba(32,28,24,.13)] active:translate-y-0"
            style={{ background: "rgba(32,28,24,.07)" }}
          >
            Войти
          </button>
          <TelegramButton />
        </div>
      </div>
    </header>
  );
}

/** Сплошная тёмная кнопка со значком Telegram — главное действие шапки. */
function TelegramButton() {
  return (
    <a
      href={BOT_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-[14.5px] font-semibold text-white transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#33312e] hover:shadow-[0_10px_26px_rgba(32,28,24,.28)] active:translate-y-0 sm:px-5"
      style={{ background: "var(--ink)" }}
    >
      <Icon name="telegram-logo" width={19} weight="fill" color="#fff" />
      <span className="hidden whitespace-nowrap sm:block">Приложение в Telegram</span>
    </a>
  );
}

/* ─────────────────────────── герой ─────────────────────────── */

function Hero({ scrollY }: { scrollY: MotionValue<number> }) {
  const calm = useReducedMotion();
  const scale = useTransform(scrollY, [0, 560], [1, 0.92]);
  const fade = useTransform(scrollY, [0, 480], [1, 0]);
  const lift = useTransform(scrollY, [0, 560], [0, -40]);

  return (
    <section id="top" className="relative overflow-hidden pb-6 pt-4 md:pb-10 md:pt-8">
      <motion.div
        className={`${WRAP} relative text-center`}
        style={calm ? undefined : { scale, opacity: fade, y: lift, transformOrigin: "top center" }}
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="inline-flex items-center gap-2 text-[15px] font-medium text-[var(--muted)]"
        >
          <Icon name="telegram-logo" width={18} weight="fill" color="#2aabee" />
          Приложение Telegram и десктоп
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.06, ease: EASE }}
          className="font-tight mx-auto mt-5 max-w-[1020px] text-[38px] font-black leading-[1.05] tracking-[-0.035em] sm:text-[48px] md:text-[68px]"
        >
          Практика психолога,<br className="hidden md:block" /> собранная в одном месте
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.14, ease: EASE }}
          className="mx-auto mt-6 max-w-[620px] text-[17px] font-medium leading-[1.5] text-[var(--muted)] md:text-[19px]"
        >
          Цифровая платформа для улучшения ментального здоровья
        </motion.p>
      </motion.div>
    </section>
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
              className="relative shrink-0 cursor-pointer rounded-full px-5 py-3 text-[15px] font-medium whitespace-nowrap transition-colors hover:text-[var(--ink)]"
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

      <motion.div
        className={`${WRAP} mt-6 md:mt-8`}
        initial={{ opacity: 0, scale: 0.94, y: 44 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <motion.div
          className="relative overflow-hidden rounded-[24px] px-3 pt-3 md:rounded-[36px] md:px-10 md:pt-10"
          animate={{ backgroundColor: tab.tone }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ height: "clamp(230px, 46vw, 620px)" }}
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
      </motion.div>
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
              <span
                className="flex h-[62px] w-[62px] items-center justify-center rounded-[20px]"
                style={{ background: card.tone }}
              >
                <Icon name={card.icon} width={30} weight="regular" color={card.edge} />
              </span>
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
      <div className="mt-12 grid grid-cols-2 gap-y-11 md:grid-cols-4">
        {TOPICS.map((topic, i) => (
          <Reveal key={topic.label} delay={(i % 4) * 0.06}>
            <div className="flex flex-col items-center justify-center gap-3 px-2 text-center sm:flex-row sm:gap-3">
              <Icon name={topic.icon} width={34} weight="duotone" color={topic.color} />
              <span
                className="font-tight text-[22px] font-black leading-[1.1] tracking-[-0.02em] md:text-[27px]"
                style={{ color: topic.color }}
              >
                {topic.label}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── возможности ─────────────────────────── */

function Features() {
  const box = useContext(ScrollBox);
  const stackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: stackRef,
    container: box ?? undefined,
    offset: ["start start", "end end"],
  });

  return (
    <section id="features" className={`${WRAP} pb-16 md:pb-24`}>
      <Reveal>
        <h2 className="font-tight max-w-[760px] text-[32px] font-black leading-[1.06] tracking-[-0.03em] sm:text-[36px] md:text-[54px]">
          Ведите практику <span style={{ color: "var(--purple-edge)" }}>удобно и эффективно</span>
        </h2>
      </Reveal>

      <div ref={stackRef} className="mt-10 space-y-4 md:mt-14 md:space-y-6">
        {FEATURES.map((block, i) => (
          <FeatureCard key={block.title} block={block} index={i} total={FEATURES.length} progress={scrollYProgress} />
        ))}
      </div>
    </section>
  );
}

/**
 * Карточка стека: пока следующая наезжает сверху, эта залипает под шапкой,
 * слегка уменьшается и уходит в фон. На телефоне стек не включаем — блок выше
 * экрана, залипать нечему, остаётся обычное появление.
 */
function FeatureCard({
  block, index, total, progress,
}: {
  block: (typeof FEATURES)[number];
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const calm = useReducedMotion();
  const wide = useWide();
  const stack = wide && !calm;
  const last = index === total - 1;
  const span: [number, number] = [index / total, (index + 1) / total];

  const scale = useTransform(progress, span, [1, last ? 1 : 0.92]);
  const veil = useTransform(progress, span, [0, last ? 0 : 0.5]);
  const shotY = useTransform(progress, span, [30, -30]);

  return (
    <div className="md:sticky" style={{ top: 84 + index * 14 }}>
      <motion.article
        initial={calm ? { opacity: 0 } : { opacity: 0, y: 34, filter: "blur(10px)" }}
        whileInView={calm ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.75, ease: EASE }}
        className="relative grid items-stretch gap-8 overflow-hidden rounded-[26px] p-6 sm:p-7 md:grid-cols-2 md:gap-10 md:rounded-[30px] md:p-12 md:pr-0"
        style={{
          background: "color-mix(in srgb, var(--ink) 5%, var(--bg))",
          boxShadow: stack ? "0 -26px 70px rgba(32,28,24,.09)" : undefined,
          ...(stack ? { scale, transformOrigin: "top center" } : null),
        }}
      >
        <div className="flex flex-col">
          <h3 className="font-tight text-[26px] font-black leading-[1.08] tracking-[-0.025em] sm:text-[28px] md:text-[40px]">{block.title}</h3>
          <p className="mt-4 max-w-[460px] text-[15px] font-medium leading-[1.55] text-[var(--muted)] md:text-[16.5px]">{block.text}</p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {block.tags.map((tag) => (
              <span
                key={tag.label}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-3.5 py-2 text-[13.5px] font-medium sm:px-4 sm:py-2.5 sm:text-[14px]"
                style={{ border: "1px solid var(--hairline)" }}
              >
                <Icon name={tag.icon} width={16} weight="regular" color="var(--ink)" />
                {tag.label}
              </span>
            ))}
          </div>

          <div className="mt-auto pt-8 md:pt-9">
            <ArrowLink href={BOT_URL}>Открыть в Telegram</ArrowLink>
          </div>
        </div>

        <div
          className="relative -mb-6 min-h-[200px] overflow-hidden rounded-[20px] sm:-mb-7 sm:min-h-[240px] md:-mb-12 md:mr-0 md:min-h-[380px] md:rounded-r-none"
          style={{ background: block.tone }}
        >
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="absolute left-5 top-7 w-[130%] overflow-hidden rounded-[14px] bg-white sm:left-6 sm:top-8 md:left-10 md:top-12"
            style={{ boxShadow: "0 20px 60px rgba(32,28,24,.16)", ...(stack ? { y: shotY } : null) }}
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

        {stack && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-[26px] md:rounded-[30px]"
            style={{ background: "var(--bg)", opacity: veil }}
          />
        )}
      </motion.article>
    </div>
  );
}

/* ─────────────────────────── вопросы ─────────────────────────── */

function Faq() {
  return (
    <section id="faq" className={`${WRAP} py-16 md:py-28`}>
      <Reveal>
        <h2 className="font-tight mx-auto max-w-[820px] text-center text-[32px] font-black leading-[1.06] tracking-[-0.03em] sm:text-[36px] md:text-[54px]">
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

const SPIN = 46;

function Orbit() {
  const calm = useReducedMotion();
  const turn = { duration: SPIN, repeat: Infinity, ease: "linear" as const };

  return (
    <section className="relative overflow-hidden py-16 md:py-24" style={{ background: "rgba(32,28,24,.03)" }}>
      <div className={`${WRAP} text-center`}>
        <Reveal>
          <h2 className="font-tight mx-auto max-w-[900px] text-[30px] font-black leading-[1.08] tracking-[-0.03em] sm:text-[36px] md:text-[48px]">
            Работайте спокойнее:{" "}
            <span className="text-[var(--muted)]">
              современные инструменты станут вашим надёжным помощником, а не врагом
            </span>
          </h2>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-12 aspect-square w-full max-w-[340px] sm:max-w-[420px] md:mt-16 md:max-w-[500px]">
        <span className="absolute inset-0 rounded-full" style={{ background: "rgba(32,28,24,.035)" }} />
        <span className="absolute inset-[15%] rounded-full" style={{ background: "rgba(32,28,24,.045)" }} />

        <motion.div className="absolute inset-0" animate={calm ? undefined : { rotate: 360 }} transition={turn}>
          {ORBIT.map((icon, i) => {
            const angle = (i / ORBIT.length) * 2 * Math.PI - Math.PI / 2;
            return (
              <span
                key={icon}
                className="absolute h-[58px] w-[58px]"
                style={{
                  left: `${50 + Math.cos(angle) * 42}%`,
                  top: `${50 + Math.sin(angle) * 42}%`,
                  marginLeft: -29,
                  marginTop: -29,
                }}
              >
                <motion.span
                  className="flex h-full w-full items-center justify-center rounded-full bg-[var(--surface)]"
                  style={{ boxShadow: "0 8px 24px rgba(32,28,24,.1)" }}
                  animate={calm ? undefined : { rotate: -360 }}
                  transition={turn}
                >
                  <Icon name={icon} width={25} weight="regular" color="var(--ink)" />
                </motion.span>
              </span>
            );
          })}
        </motion.div>

        <span
          className="absolute left-1/2 top-1/2 flex h-[110px] w-[110px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full md:h-[132px] md:w-[132px]"
          style={{ background: "var(--ink)" }}
        >
          <span className="font-tight text-[19px] font-black tracking-[-0.03em] text-white md:text-[23px]">{APP_NAME}</span>
        </span>
      </div>
    </section>
  );
}

/* ─────────────────────────── для кого ─────────────────────────── */

function Who() {
  return (
    <section id="who" className={`${WRAP} py-16 md:py-28`}>
      <div className="grid gap-8 md:grid-cols-[minmax(0,400px)_1fr] md:gap-14">
        <div className="md:sticky md:top-[104px] md:self-start">
          <Reveal>
            <h2 className="font-tight text-[32px] font-black leading-[1.06] tracking-[-0.03em] sm:text-[36px] md:text-[46px]">
              Две стороны одной встречи.{" "}
              <span className="text-[var(--muted)]">Приложение одно.</span>
            </h2>
            <div className="mt-7">
              <SoftButton href={BOT_URL}>Посмотреть в Telegram</SoftButton>
            </div>
          </Reveal>
        </div>

        <div className="grid gap-4">
        {WHO.map((side, i) => (
          <Reveal key={side.who} delay={i * 0.08}>
            <motion.article
              whileHover={{ y: -6 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="h-full rounded-[28px] p-7 sm:p-8 md:p-10"
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
      </div>
    </section>
  );
}

/* ─────────────────────────── финальный призыв ─────────────────────────── */

function Cta() {
  return (
    <section className="relative overflow-hidden pb-24 pt-32 md:pb-32 md:pt-56">
      <span className="pointer-events-none absolute right-[-6%] top-0 h-[300px] w-[520px] rounded-full" style={{ background: "rgba(32,28,24,.045)" }} />

      <div className={`${WRAP} relative text-center`}>
        <Reveal>
          <h2 className="font-tight mx-auto max-w-[820px] text-[34px] font-black leading-[1.05] tracking-[-0.035em] sm:text-[42px] md:text-[64px]">
            Начните вести практику <span style={{ color: "var(--purple-edge)" }}>бесплатно</span>
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] font-medium leading-[1.5] text-[var(--muted)] md:text-[19px]">
            Приложение не требует установки и паролей, вы заходите через учётную запись в Telegram.
            Все сведения зашифрованы и конфиденциальны.
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
            {LEGAL_DOCS.map((doc) => (
              <a key={doc.href} href={doc.href} className={FOOT_LINK}>{doc.title}</a>
            ))}
          </FooterCol>
        </div>

        <p className="mt-10 border-t pt-6 text-[13px] font-medium text-[var(--muted-2)]" style={{ borderColor: "var(--hairline)" }}>
          Платформа не оказывает экстренную и медицинскую помощь.<br />
          {LEGAL.operator}, {LEGAL.status}, ИНН {LEGAL.inn}. Связь: {LEGAL.email}.
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
