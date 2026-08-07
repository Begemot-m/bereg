"use client";

import { motion } from "motion/react";
import { type ReactNode, type UIEvent, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { AUDIENCE, FEATURES, VALUE } from "@/components/landing";
import { WebLogin } from "@/components/web-login";
import { APP_NAME, BOT_NAME, CENTER, CENTER_URL, TAGLINE, botDeepLink } from "@/lib/brand";

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

// Крупные блоки: боль → что делает платформа → чем это видно в интерфейсе.
const SHOWCASE: {
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  icon: IconName;
  tone: string;
  edge: string;
  panel: string[];
}[] = [
  {
    eyebrow: "Клиенты",
    title: "История клиента вместо памяти и переписок",
    text: "Карточка собирает всё, что нужно к началу встречи: контакты, статус, прошлые сессии, заметки, домашние задания и динамику состояния.",
    points: ["Заметки к каждой встрече", "Статистика по терапии", "Домашние задания и ответы"],
    icon: "users", tone: "var(--green-soft)", edge: "var(--green-edge)",
    panel: ["Марина · 12 сессий", "Заметка к встрече 14 мая", "Домашнее задание выполнено"],
  },
  {
    eyebrow: "Расписание",
    title: "Запись, переносы и напоминания без ручной работы",
    text: "Вы задаёте рабочие часы по дням недели — дальше клиент сам занимает свободное окно, получает напоминание и переносит встречу, не отвлекая вас.",
    points: ["Окна по часам недели", "Онлайн и очный формат", "Напоминания в Telegram"],
    icon: "calendar", tone: "var(--purple-soft)", edge: "var(--purple-edge)",
    panel: ["Вторник · 11:00 свободно", "Четверг · 18:00 занято", "Напоминание за час"],
  },
  {
    eyebrow: "Каталог",
    title: "Люди находят вас по запросу, а не по репосту",
    text: "Анкета проходит проверку и попадает в каталог. Подбор идёт по запросу, методу, формату, городу и бюджету — к вам приходят те, кому вы подходите.",
    points: ["Проверенная анкета", "Фильтры по методу и цене", "Запись сразу в свободное окно"],
    icon: "compass", tone: "var(--amber-soft)", edge: "var(--amber-edge)",
    panel: ["Запрос: тревога", "Метод: КПТ", "Формат: онлайн"],
  },
];

/**
 * Лендинг боевого сайта: что это за платформа и как в неё попасть. Гость идёт
 * в Telegram, а у кого аккаунт уже есть — входит здесь по почте.
 */
export function WebLanding() {
  const [login, setLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[95] overflow-y-auto"
      onScroll={(e: UIEvent<HTMLDivElement>) => setScrolled(e.currentTarget.scrollTop > 12)}
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
        <section className="mx-auto w-full max-w-[1180px] px-5 pt-12 text-center md:px-8 md:pt-24">
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
            Практика психолога,<br />собранная в одном месте
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-5 max-w-[620px] text-[16px] font-semibold leading-relaxed text-[var(--muted)] md:mt-6 md:text-[19px]"
          >
            Расписание, карточки клиентов, домашние задания и динамика состояния живут
            вместе — а не в семи разных приложениях и блокноте.
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
        </section>

        <Marquee />

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
                    </div>

                    <div
                      className="relative flex min-h-[240px] flex-col justify-center gap-3 rounded-[26px] p-6 md:min-h-[320px] md:p-8"
                      style={{ background: block.tone, border: "var(--bw) solid var(--ink)" }}
                    >
                      <span className="absolute right-6 top-6 opacity-25 md:right-8 md:top-8">
                        <Icon name={block.icon} width={64} weight="bold" color={block.edge} />
                      </span>
                      {block.panel.map((row, r) => (
                        <motion.div
                          key={row}
                          initial={{ opacity: 0, x: -14 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true, margin: "-80px" }}
                          transition={{ duration: 0.5, delay: 0.12 + r * 0.09, ease: [0.16, 1, 0.3, 1] }}
                          className="flex items-center gap-3 rounded-[16px] bg-white px-4 py-3.5"
                          style={{ border: "var(--bw) solid var(--ink)" }}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: block.edge }} />
                          <span className="text-[13.5px] font-black md:text-[14.5px]">{row}</span>
                        </motion.div>
                      ))}
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
