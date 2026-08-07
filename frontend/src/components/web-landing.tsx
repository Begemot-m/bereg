"use client";

import { AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import Image from "next/image";
import { type ReactNode, type UIEvent, useEffect, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { AUDIENCE, FEATURES, VALUE } from "@/components/landing";
import { WebLogin } from "@/components/web-login";
import { asset } from "@/lib/asset";
import { APP_NAME, BOT_NAME, CENTER, CENTER_URL, TAGLINE, botDeepLink } from "@/lib/brand";

const EASE = [0.16, 1, 0.3, 1] as const;

const BOT_URL = botDeepLink("site");

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "telegram", title: "Открыть бота с телефона", text: `Ссылка t.me/${BOT_NAME} — приложение запускается прямо внутри Telegram` },
  { icon: "lock", title: "Вход одним касанием", text: "Аккаунт Telegram и есть вход: ни паролей, ни писем, ни установки" },
  { icon: "spark", title: "Выбрать роль", text: "Психолог ведёт практику, клиент записывается и отмечает состояние" },
];

// Лента запросов — те же фильтры, по которым каталог подбирает специалиста.
const TOPICS = [
  "Тревога", "КПТ", "Выгорание", "Отношения", "Схема-терапия", "Самооценка",
  "Панические атаки", "Гештальт", "Травма", "ACT", "Подростки", "Расставание",
];

// Крупные блоки: боль → что делает платформа → как это выглядит на экране.
// Метрики намеренно счётные: процентов роста, которых мы не измеряли, тут нет.
const SHOWCASE: {
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  icon: IconName;
  tone: string;
  edge: string;
  shot: string;
  stats: { value: string; label: string }[];
}[] = [
  {
    eyebrow: "Клиенты",
    title: "Вся история клиента — под рукой",
    text: "Карточка собирает то, что раньше жило в блокноте и переписках: контакты, статус, прошлые встречи, заметки, домашние задания и динамику состояния. Вы открываете её за минуту до сессии и уже всё помните.",
    points: ["Заметки к каждой встрече", "Хронология сессий и статистика по терапии", "Домашние задания и ответы клиента", "Динамика настроения между встречами"],
    icon: "users", tone: "var(--green-soft)", edge: "var(--green-edge)",
    shot: "clients",
    stats: [{ value: "1", label: "карточка вместо блокнота и чата" }, { value: "0", label: "таблиц, которые надо вести руками" }],
  },
  {
    eyebrow: "Расписание",
    title: "Расписание, которое работает за вас",
    text: "Забудьте переписку «когда вам удобно?». Вы задаёте рабочие часы по дням недели — клиент сам занимает свободное окно, получает напоминание и переносит встречу, не отвлекая вас.",
    points: ["Окна по часам недели", "Клиент записывается сам", "Онлайн и очный формат", "Напоминания в Telegram без вашего участия"],
    icon: "calendar", tone: "var(--purple-soft)", edge: "var(--purple-edge)",
    shot: "sessions",
    stats: [{ value: "24/7", label: "запись открыта, пока вы спите" }, { value: "0", label: "сообщений на согласование времени" }],
  },
  {
    eyebrow: "Каталог",
    title: "Люди находят вас по запросу, а не по репосту",
    text: "Анкета проходит проверку руками и попадает в каталог. Подбор идёт по запросу, методу, формату, городу и бюджету — к вам приходят те, кому вы действительно подходите.",
    points: ["Анкета с проверкой, а не автопубликация", "Фильтры по запросу и методу", "Цена и формат видны сразу", "Запись прямо в свободное окно"],
    icon: "compass", tone: "var(--amber-soft)", edge: "var(--amber-edge)",
    shot: "catalog",
    stats: [{ value: "5", label: "фильтров подбора: запрос, метод, формат, город, бюджет" }, { value: "0 ₽", label: "стоит попасть в каталог" }],
  },
];

// Вкладки «как это выглядит»: реальные экраны приложения, снятые с демо-данных.
const TABS: { key: string; label: string; icon: IconName; title: string; text: string; points: string[]; tone: string; edge: string }[] = [
  {
    key: "home-psy", label: "Кабинет", icon: "home",
    title: "День психолога на одном экране",
    text: "Ближайшая встреча, статистика недели и разделы — без поиска по вкладкам.",
    points: ["Ближайшая сессия сверху", "Сессии и часы за неделю", "Быстрый переход в разделы"],
    tone: "var(--amber-soft)", edge: "var(--amber-edge)",
  },
  {
    key: "sessions", label: "Сессии", icon: "calendar",
    title: "Неделя, окна и записи",
    text: "Календарь на две недели вперёд, свободные окна и все встречи в одном списке.",
    points: ["Рабочие часы по дням", "Онлайн и очно", "Переносы и отмены"],
    tone: "var(--purple-soft)", edge: "var(--purple-edge)",
  },
  {
    key: "clients", label: "Клиенты", icon: "users",
    title: "Список клиентов и их статусы",
    text: "Кто в работе, кто на паузе, когда была последняя встреча и что осталось на следующую.",
    points: ["Статусы и теги", "История сессий", "Заметки только для вас"],
    tone: "var(--green-soft)", edge: "var(--green-edge)",
  },
  {
    key: "therapy", label: "Терапия", icon: "pulse",
    title: "Что происходит между встречами",
    text: "Сторона клиента: настроение, домашние задания, рефлексии и ближайшая запись.",
    points: ["Чек-ин настроения", "Домашние задания", "Колесо баланса"],
    tone: "var(--coral-soft)", edge: "var(--coral)",
  },
  {
    key: "catalog", label: "Каталог", icon: "compass",
    title: "Подбор специалиста по запросу",
    text: "Персональная подборка и фильтры вместо ленты случайных рекомендаций.",
    points: ["Проверенные анкеты", "Фильтры по методу и цене", "Запись в свободное окно"],
    tone: "var(--green-soft)", edge: "var(--green-edge)",
  },
  {
    key: "tools", label: "Инструменты", icon: "spark",
    title: "Короткая помощь в трудный момент",
    text: "Практики, которые доступны без записи и без специалиста — бесплатно.",
    points: ["Дыхание и заземление", "Без регистрации в кабинете", "Доступно всегда"],
    tone: "var(--purple-soft)", edge: "var(--purple-edge)",
  },
];

// Счётные факты. Ничего, что нельзя проверить, открыв приложение.
const METRICS: { value: string; label: string }[] = [
  { value: "8", label: "разделов уже работают" },
  { value: "1", label: "касание до входа" },
  { value: "0", label: "установок и паролей" },
  { value: "2", label: "роли: психолог и клиент" },
];

// Плавающие маскоты из дневника настроения — те же, что видит клиент в приложении.
const MASCOTS: { src: string; className: string; size: number; drift: number; delay: number }[] = [
  { src: "/mascots/fox-great.webp", className: "left-[3%] top-[14%]", size: 96, drift: -70, delay: 0 },
  { src: "/mascots/owl-good.webp", className: "right-[4%] top-[10%]", size: 84, drift: -110, delay: 0.6 },
  { src: "/mascots/cat-great.webp", className: "left-[9%] bottom-[6%]", size: 76, drift: -40, delay: 1.1 },
  { src: "/mascots/panda-good.webp", className: "right-[8%] bottom-[10%]", size: 92, drift: -85, delay: 0.3 },
];

/**
 * Лендинг боевого сайта: что это за платформа и как в неё попасть. Гость идёт
 * в Telegram, а у кого аккаунт уже есть — входит здесь по почте.
 */
export function WebLanding() {
  const [login, setLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Позиция скролла живёт в motion value: иначе параллакс перерисовывал бы
  // весь лендинг на каждом кадре колеса.
  const scrollY = useMotionValue(0);

  return (
    <div
      className="fixed inset-0 z-[95] overflow-y-auto"
      onScroll={(e: UIEvent<HTMLDivElement>) => {
        const top = e.currentTarget.scrollTop;
        scrollY.set(top);
        setScrolled((was) => (was === top > 12 ? was : top > 12));
      }}
      style={{ background: "radial-gradient(120% 60% at 50% -12%, #fffdf7 0%, var(--bg) 58%)" }}
    >
      <header className="sticky top-0 z-20 px-3 pt-[max(env(safe-area-inset-top),12px)] md:px-6 md:pt-4">
        <div
          className="mx-auto flex w-full max-w-[1180px] items-center justify-between rounded-full px-3 py-2.5 transition-all duration-300 md:px-4"
          style={{
            background: scrolled ? "rgba(255,253,247,.82)" : "transparent",
            backdropFilter: scrolled ? "blur(14px)" : "none",
            border: `var(--bw) solid ${scrolled ? "var(--ink)" : "transparent"}`,
            boxShadow: scrolled ? "0 6px 0 -3px rgba(32,28,24,.1)" : "none",
          }}
        >
          <span className="inline-flex items-center gap-2.5 pl-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] text-[17px] font-black text-[var(--bg)]" style={{ background: "var(--ink)" }}>
              {APP_NAME.charAt(0)}
            </span>
            <span className="font-tight text-[21px] font-black tracking-[-0.02em]">{APP_NAME}</span>
          </span>
          <nav className="hidden items-center gap-7 lg:flex">
            {[["Возможности", "#value"], ["Как устроено", "#how"], ["Для кого", "#who"], ["Вход", "#enter"]].map(([label, href]) => (
              <a key={href} href={href} className="text-[14px] font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)]">
                {label}
              </a>
            ))}
          </nav>
          <span className="flex items-center gap-2">
            <button onClick={() => setLogin(true)} className="rounded-full px-4 py-2.5 text-[13.5px] font-black text-[var(--ink)] transition-colors hover:bg-[rgba(32,28,24,.06)]">
              Войти
            </button>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-black text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[.97]"
              style={{ background: "var(--ink)" }}
            >
              <Icon name="telegram" width={15} weight="bold" color="#fff" /> В Telegram
            </a>
          </span>
        </div>
      </header>

      <main className="w-full">
        <section className="relative mx-auto w-full max-w-[1180px] px-5 pt-12 text-center md:px-8 md:pt-24">
          <HeroMascots scrollY={scrollY} />
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="chip inline-flex"
            style={{ background: "var(--green-soft)", color: "var(--green-edge)" }}
          >
            <Icon name="check" width={12} weight="bold" color="var(--green-edge)" /> Работает прямо в Telegram
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="font-tight mx-auto mt-5 max-w-[900px] text-[42px] font-black leading-[1.02] tracking-[-0.035em] md:mt-7 md:text-[76px]"
          >
            Всё, что нужно<br />для практики.<br />
            <span className="text-[var(--muted)]">В одном месте.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-5 max-w-[620px] text-[16px] font-semibold leading-relaxed text-[var(--muted)] md:mt-6 md:text-[19px]"
          >
            Восемь разделов вместо пяти сервисов, блокнота и переписок. Расписание, клиенты,
            домашние задания и динамика состояния — внутри Telegram, без установки и паролей.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3 md:mt-10"
          >
            <a
              href={BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-[15px] font-black text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[.97] md:text-[16px]"
              style={{ background: "var(--ink)" }}
            >
              <Icon name="telegram" width={18} weight="bold" color="#fff" /> Открыть в Telegram
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-[15px] font-black text-[var(--ink)] transition-transform duration-200 hover:scale-[1.03] active:scale-[.97] md:text-[16px]"
              style={{ border: "var(--bw) solid var(--ink)" }}
            >
              Как это устроено
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.34 }}
            className="mt-5 text-[13px] font-bold text-[var(--muted-2)]"
          >
            Ни установки, ни паролей · Создано в центре{" "}
            <a href={CENTER_URL} target="_blank" rel="noreferrer" className="underline decoration-[1.5px] underline-offset-2 hover:text-[var(--muted)]">{CENTER}</a>
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.42, ease: EASE }}
            className="mt-10 flex flex-wrap items-center justify-center gap-2.5 md:mt-14 md:gap-3"
          >
            {TABS.map((tab) => (
              <span
                key={tab.key}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-black md:text-[14px]"
                style={{ border: "var(--bw) solid var(--ink)" }}
              >
                <Icon name={tab.icon} width={15} weight="bold" color={tab.edge} /> {tab.label}
              </span>
            ))}
          </motion.div>
        </section>

        <Marquee />

        <ProductTabs />

        <div className="mx-auto w-full max-w-[1180px] px-5 pb-20 md:px-8 md:pb-28">
          <Section id="value" eyebrow="Зачем это нужно" title="Четыре вещи, ради которых платформу заводят">
            <div className="grid gap-3.5 md:grid-cols-2 md:gap-5">
              {VALUE.map((item, i) => (
                <Rise key={item.title} delay={i * 0.06}>
                  <motion.article
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="flex h-full flex-col rounded-[30px] p-6 md:p-8"
                    style={{ background: item.tone, border: "var(--bw-lg) solid var(--ink)" }}
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white" style={{ border: "var(--bw) solid var(--ink)" }}>
                      <Icon name={item.icon} width={26} weight="bold" color={item.edge} />
                    </span>
                    <h3 className="font-tight mt-5 text-[22px] font-black leading-[1.12] tracking-[-0.02em] md:text-[27px]">{item.title}</h3>
                    <p className="mt-3 text-[14px] font-semibold leading-relaxed text-[var(--muted)] md:text-[15.5px]">{item.text}</p>
                  </motion.article>
                </Rise>
              ))}
            </div>
          </Section>

          <section id="how" className="mt-24 scroll-mt-24 md:mt-36">
            <p className="text-[12.5px] font-black uppercase tracking-[.12em] text-[var(--muted-2)]">Как устроено</p>
            <h2 className="font-tight mt-3 max-w-[800px] text-[32px] font-black leading-[1.04] tracking-[-0.03em] md:text-[52px]">
              Три части, которые обычно живут порознь
            </h2>

            <div className="mt-12 space-y-5 md:mt-16 md:space-y-8">
              {SHOWCASE.map((block, i) => (
                <Rise key={block.eyebrow} delay={0.04}>
                  <article
                    className="grid items-center gap-8 overflow-hidden rounded-[34px] bg-white p-6 md:gap-12 md:p-12 lg:grid-cols-2"
                    style={{ border: "var(--bw-lg) solid var(--ink)" }}
                  >
                    <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
                      <span className="chip" style={{ background: block.tone, color: block.edge }}>
                        <Icon name={block.icon} width={13} weight="bold" color={block.edge} /> {block.eyebrow}
                      </span>
                      <h3 className="font-tight mt-4 text-[26px] font-black leading-[1.08] tracking-[-0.025em] md:text-[38px]">{block.title}</h3>
                      <p className="mt-4 max-w-[520px] text-[14.5px] font-semibold leading-relaxed text-[var(--muted)] md:text-[16.5px]">{block.text}</p>
                      <ul className="mt-6 space-y-3">
                        {block.points.map((point) => (
                          <li key={point} className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: block.tone }}>
                              <Icon name="check" width={13} weight="bold" color={block.edge} />
                            </span>
                            <span className="text-[14px] font-bold md:text-[15px]">{point}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-8 flex flex-wrap gap-3">
                        {block.stats.map((stat) => (
                          <div
                            key={stat.label}
                            className="min-w-[150px] flex-1 rounded-[20px] p-4"
                            style={{ background: block.tone, border: "var(--bw) solid var(--ink)" }}
                          >
                            <p className="font-tight text-[30px] font-black leading-none tracking-[-0.03em] md:text-[36px]" style={{ color: block.edge }}>
                              {stat.value}
                            </p>
                            <p className="mt-1.5 text-[12.5px] font-bold leading-snug text-[var(--muted)]">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className="relative flex items-center justify-center rounded-[26px] p-8 md:p-10"
                      style={{ background: block.tone, border: "var(--bw) solid var(--ink)" }}
                    >
                      <span className="absolute right-6 top-6 opacity-20 md:right-8 md:top-8">
                        <Icon name={block.icon} width={64} weight="bold" color={block.edge} />
                      </span>
                      <Phone shot={block.shot} lift />
                    </div>
                  </article>
                </Rise>
              ))}
            </div>
          </section>

          <Section eyebrow="Функции" title="Что уже работает">
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4">
              {FEATURES.map((item, i) => (
                <Rise key={item.title} delay={i * 0.04}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="flex h-full flex-col rounded-[24px] bg-white p-5 md:p-6"
                    style={{ border: "var(--bw) solid var(--ink)" }}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--head-soft)" }}>
                      <Icon name={item.icon} width={20} weight="bold" color="var(--edge)" />
                    </span>
                    <p className="font-tight mt-4 text-[16px] font-black leading-tight tracking-[-0.015em] md:text-[17.5px]">{item.title}</p>
                    <p className="mt-2 text-[13px] font-semibold leading-snug text-[var(--muted)] md:text-[13.5px]">{item.text}</p>
                  </motion.div>
                </Rise>
              ))}
            </div>
          </Section>

          <Section id="who" eyebrow="Для кого" title="Две стороны одной встречи">
            <div className="grid gap-3.5 md:grid-cols-2 md:gap-5">
              {AUDIENCE.map((item, i) => (
                <Rise key={item.who} delay={i * 0.08}>
                  <article className="h-full rounded-[30px] p-6 md:p-9" style={{ background: item.tone, border: "var(--bw-lg) solid var(--ink)" }}>
                    <div className="flex items-center gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white" style={{ border: "var(--bw) solid var(--ink)" }}>
                        <Icon name={item.icon} width={25} weight="bold" color={item.edge} />
                      </span>
                      <h3 className="font-tight text-[26px] font-black tracking-[-0.02em] md:text-[32px]">{item.who}</h3>
                    </div>
                    <ul className="mt-6 space-y-3.5">
                      {item.points.map((point) => (
                        <li key={point} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
                            <Icon name="check" width={13} weight="bold" color={item.edge} />
                          </span>
                          <span className="text-[14.5px] font-semibold leading-snug md:text-[15.5px]">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </Rise>
              ))}
            </div>
          </Section>

          <Rise>
            <div
              className="mt-24 grid grid-cols-2 gap-px overflow-hidden rounded-[30px] md:mt-36 md:grid-cols-4"
              style={{ background: "var(--ink)", border: "var(--bw-lg) solid var(--ink)" }}
            >
              {METRICS.map((metric) => (
                <div key={metric.label} className="bg-white p-6 text-center md:p-8">
                  <p className="font-tight text-[42px] font-black leading-none tracking-[-0.04em] md:text-[56px]">{metric.value}</p>
                  <p className="mt-2.5 text-[12.5px] font-bold leading-snug text-[var(--muted)] md:text-[13.5px]">{metric.label}</p>
                </div>
              ))}
            </div>
          </Rise>

          <Section eyebrow="Как войти" title="Три шага, и вы внутри">
            <div className="grid gap-3.5 md:grid-cols-3 md:gap-5">
              {STEPS.map((step, i) => (
                <Rise key={step.title} delay={i * 0.07}>
                  <div className="flex h-full flex-col rounded-[26px] bg-white p-6 md:p-7" style={{ border: "var(--bw) solid var(--ink)" }}>
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]" style={{ background: "var(--head-soft)" }}>
                        <Icon name={step.icon} width={22} weight="bold" color="var(--edge)" />
                      </span>
                      <span className="font-tight text-[40px] font-black leading-none text-[var(--muted-2)] md:text-[48px]">{i + 1}</span>
                    </div>
                    <p className="font-tight mt-5 text-[18px] font-black leading-tight tracking-[-0.015em] md:text-[20px]">{step.title}</p>
                    <p className="mt-2 text-[13.5px] font-semibold leading-snug text-[var(--muted)] md:text-[14.5px]">{step.text}</p>
                  </div>
                </Rise>
              ))}
            </div>
          </Section>

          {/* Порядок именно такой: аккаунт заводится в Telegram, почта — второй
              ключ к нему же. Обещать вход «без телефона» нельзя: сервер по
              незнакомой почте аккаунтов не создаёт. */}
          <Rise>
            <section id="enter" className="mt-24 scroll-mt-24 overflow-hidden rounded-[36px] bg-[var(--ink)] text-white md:mt-36">
              <div className="flex items-center gap-12 p-8 md:p-14">
                <div className="min-w-0 flex-1">
                  <span className="chip uppercase" style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}>
                    <Icon name="lock" width={12} weight="bold" color="#fff" /> Вход с компьютера
                  </span>
                  <h2 className="font-tight mt-5 text-[30px] font-black leading-[1.04] tracking-[-0.03em] md:text-[48px]">
                    С компьютера — по коду из письма
                  </h2>
                  <p className="mt-4 max-w-[600px] text-[15px] font-semibold leading-relaxed text-white/75 md:text-[17px]">
                    Аккаунт заводится в Telegram: одно касание, устанавливать ничего не нужно. Там же
                    в кабинете привязывается почта — и после этого в браузер можно войти по коду.
                    Расписание, клиенты и записи открываются те же.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setLogin(true)}
                      className="inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-4 text-[15px] font-black text-[var(--ink)] transition-transform duration-200 hover:scale-[1.03] active:scale-[.97] md:text-[16px]"
                    >
                      <Icon name="lock" width={18} weight="bold" color="var(--ink)" /> Войти по почте
                    </button>
                    <a
                      href={BOT_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-[15px] font-black text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[.97] md:text-[16px]"
                      style={{ background: "rgba(255,255,255,.16)" }}
                    >
                      <Icon name="telegram" width={18} weight="bold" color="#fff" /> Перейти в бота
                    </a>
                    <span className="text-[13px] font-bold text-white/55">t.me/{BOT_NAME}</span>
                  </div>
                </div>
                <span className="hidden h-32 w-32 shrink-0 items-center justify-center rounded-[32px] lg:flex" style={{ background: "rgba(255,255,255,.14)" }}>
                  <Icon name="telegram" width={62} weight="bold" color="#fff" />
                </span>
              </div>
            </section>
          </Rise>

          <footer className="mt-16 md:mt-24">
            <div className="flex flex-wrap items-end justify-between gap-8 border-t pt-10" style={{ borderColor: "var(--edge-neutral)" }}>
              <div className="min-w-0">
                <span className="font-tight text-[44px] font-black leading-none tracking-[-0.04em] md:text-[64px]">{APP_NAME}</span>
                <p className="mt-3 max-w-[420px] text-[13.5px] font-semibold text-[var(--muted)]">
                  {TAGLINE}. Создано в центре{" "}
                  <a href={CENTER_URL} target="_blank" rel="noreferrer" className="font-black underline">{CENTER}</a>.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-12 gap-y-6">
                <nav className="flex flex-col gap-2.5">
                  <p className="text-[11.5px] font-black uppercase tracking-[.12em] text-[var(--muted-2)]">Платформа</p>
                  <a href="#value" className="text-[14px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Возможности</a>
                  <a href="#how" className="text-[14px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Как устроено</a>
                  <a href="#who" className="text-[14px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Для кого</a>
                </nav>
                <nav className="flex flex-col gap-2.5">
                  <p className="text-[11.5px] font-black uppercase tracking-[.12em] text-[var(--muted-2)]">Начать</p>
                  <a href={BOT_URL} target="_blank" rel="noreferrer" className="text-[14px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Открыть в Telegram</a>
                  <button onClick={() => setLogin(true)} className="text-left text-[14px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Войти по почте</button>
                  <a href="/policy" className="text-[14px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Политика и условия</a>
                </nav>
              </div>
            </div>
            <p className="mt-10 pb-[max(env(safe-area-inset-bottom),20px)] text-[12.5px] font-semibold text-[var(--muted-2)]">
              Платформа не оказывает экстренную и медицинскую помощь.
            </p>
          </footer>
        </div>
      </main>

      {login && <WebLogin onClose={() => setLogin(false)} />}
    </div>
  );
}

/** Бесконечная лента запросов: показывает объём каталога без выдуманных цифр. */
function Marquee() {
  const row = [...TOPICS, ...TOPICS];
  return (
    <div className="relative mt-14 overflow-hidden py-6 md:mt-20" style={{ borderTop: "var(--bw) solid var(--ink)", borderBottom: "var(--bw) solid var(--ink)", background: "var(--surface-2)" }}>
      <motion.div
        className="flex w-max gap-3"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
      >
        {row.map((topic, i) => (
          <span
            key={`${topic}-${i}`}
            className="shrink-0 rounded-full bg-white px-5 py-2.5 text-[14px] font-black whitespace-nowrap md:text-[15px]"
            style={{ border: "var(--bw) solid var(--ink)" }}
          >
            {topic}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-24 scroll-mt-24 md:mt-36">
      <p className="text-[12.5px] font-black uppercase tracking-[.12em] text-[var(--muted-2)]">{eyebrow}</p>
      <h2 className="font-tight mt-3 max-w-[800px] text-[32px] font-black leading-[1.04] tracking-[-0.03em] md:text-[52px]">{title}</h2>
      <div className="mt-10 md:mt-14">{children}</div>
    </section>
  );
}

/**
 * Экран приложения в рамке телефона. Скриншоты сняты с демо-режима
 * (`scripts` → Playwright, 390×844, dpr 2) и лежат в `public/shots`.
 */
function Phone({ shot, lift = false }: { shot: string; lift?: boolean }) {
  return (
    <motion.div
      whileHover={lift ? { y: -8, rotate: -1 } : undefined}
      transition={{ duration: 0.35, ease: EASE }}
      className="relative w-full max-w-[268px] overflow-hidden rounded-[34px] bg-white md:max-w-[290px]"
      style={{ border: "var(--bw-lg) solid var(--ink)", boxShadow: "0 18px 0 -10px rgba(32,28,24,.14)" }}
    >
      <span className="absolute left-1/2 top-2.5 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-[rgba(32,28,24,.18)]" />
      <Image
        src={asset(`/shots/${shot}.png`)}
        alt=""
        width={390}
        height={844}
        className="block h-auto w-full"
        unoptimized
      />
    </motion.div>
  );
}

/**
 * «Как это выглядит»: вкладки с реальными экранами. Пока человек не выбрал
 * вкладку сам, панель листается по кругу — иначе первый экран так и остаётся
 * единственным, который кто-либо видел.
 */
function ProductTabs() {
  const [active, setActive] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current) return;
    const id = setInterval(() => {
      if (touched.current) return;
      setActive((i) => (i + 1) % TABS.length);
    }, 4600);
    return () => clearInterval(id);
  }, []);

  const tab = TABS[active];

  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 pt-24 md:px-8 md:pt-36">
      <p className="text-[12.5px] font-black uppercase tracking-[.12em] text-[var(--muted-2)]">Как это выглядит</p>
      <h2 className="font-tight mt-3 max-w-[800px] text-[32px] font-black leading-[1.04] tracking-[-0.03em] md:text-[52px]">
        Не макеты, а живые экраны
      </h2>

      <div className="mt-8 -mx-5 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2 rounded-full p-1.5" style={{ background: "var(--surface-2)", border: "var(--bw) solid var(--ink)" }}>
          {TABS.map((item, i) => (
            <button
              key={item.key}
              onClick={() => {
                touched.current = true;
                setActive(i);
              }}
              className="relative rounded-full px-4 py-2.5 text-[13.5px] font-black whitespace-nowrap transition-colors md:px-5 md:text-[14.5px]"
              style={{ color: i === active ? "var(--ink)" : "var(--muted)" }}
            >
              {i === active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-white"
                  style={{ border: "var(--bw) solid var(--ink)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-2">
                <Icon name={item.icon} width={15} weight="bold" color={i === active ? item.edge : "var(--muted-2)"} />
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="mt-6 grid items-center gap-8 overflow-hidden rounded-[34px] bg-white p-6 md:mt-8 md:gap-12 md:p-12 lg:grid-cols-[1fr_auto]"
        style={{ border: "var(--bw-lg) solid var(--ink)" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab.key}-text`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <span className="chip" style={{ background: tab.tone, color: tab.edge }}>
              <Icon name={tab.icon} width={13} weight="bold" color={tab.edge} /> {tab.label}
            </span>
            <h3 className="font-tight mt-4 text-[26px] font-black leading-[1.08] tracking-[-0.025em] md:text-[38px]">{tab.title}</h3>
            <p className="mt-4 max-w-[480px] text-[14.5px] font-semibold leading-relaxed text-[var(--muted)] md:text-[16.5px]">{tab.text}</p>
            <ul className="mt-6 space-y-3">
              {tab.points.map((point) => (
                <li key={point} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: tab.tone }}>
                    <Icon name="check" width={13} weight="bold" color={tab.edge} />
                  </span>
                  <span className="text-[14px] font-bold md:text-[15px]">{point}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center rounded-[26px] p-6 md:p-8" style={{ background: tab.tone, border: "var(--bw) solid var(--ink)" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.key}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="w-full max-w-[268px] md:max-w-[290px]"
            >
              <Phone shot={tab.key} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/** Маскоты дневника настроения летают над hero и отстают от скролла. */
function HeroMascots({ scrollY }: { scrollY: MotionValue<number> }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-visible lg:block">
      {MASCOTS.map((mascot) => (
        <Mascot key={mascot.src} scrollY={scrollY} {...mascot} />
      ))}
    </div>
  );
}

function Mascot({
  scrollY, src, className, size, drift, delay,
}: { scrollY: MotionValue<number>; src: string; className: string; size: number; drift: number; delay: number }) {
  const y = useTransform(scrollY, [0, 900], [0, drift]);
  return (
    <motion.div className={`absolute ${className}`} style={{ y }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, y: [0, -12, 0], rotate: [-3, 3, -3] }}
        transition={{
          opacity: { duration: 0.6, delay: 0.3 + delay, ease: EASE },
          scale: { duration: 0.6, delay: 0.3 + delay, ease: EASE },
          y: { duration: 6 + delay, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 9 + delay, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <Image src={asset(src)} alt="" width={size} height={size} className="select-none" unoptimized />
      </motion.div>
    </motion.div>
  );
}

function Rise({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
