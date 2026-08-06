"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { APP_NAME, CENTER, CENTER_URL, TAGLINE, botDeepLink } from "@/lib/brand";

const BOT_URL = botDeepLink("site");

// Что платформа решает. Формулировки от боли специалиста, а не от списка фич.
const VALUE: { icon: IconName; title: string; text: string; tone: string; edge: string }[] = [
  {
    icon: "users", tone: "var(--green-soft)", edge: "var(--green)",
    title: "Клиенты в одном месте",
    text: "Карточка на каждого: контакты, статус, история встреч, заметки и динамика. Ничего не приходится держать в голове и в переписках.",
  },
  {
    icon: "calendar", tone: "var(--purple-soft)", edge: "var(--purple)",
    title: "Расписание, которое ведёт себя само",
    text: "Задаёте рабочие часы — клиент записывается в свободные окна сам. Переносы и отмены не превращаются в десять сообщений.",
  },
  {
    icon: "pulse", tone: "var(--amber-soft)", edge: "var(--amber)",
    title: "Видно, что между сессиями",
    text: "Настроение, колесо баланса, домашние задания и рефлексии клиент отмечает сам. Вы приходите на встречу, уже понимая, как прошла неделя.",
  },
  {
    icon: "compass", tone: "var(--coral-soft)", edge: "var(--coral)",
    title: "Клиенты, которые вас находят",
    text: "Проверенная анкета попадает в каталог: подбор идёт по запросу, методу, формату, городу и бюджету — а не по случайному репосту.",
  },
];

// Функции — короткими плитками: человек считывает объём за один взгляд.
const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "calendar", title: "Сессии и окна", text: "Рабочие часы по дням, запись клиента, переносы, онлайн и очно" },
  { icon: "users", title: "Карточки клиентов", text: "Статусы, контакты, заметки к встречам, статистика по терапии" },
  { icon: "note", title: "Домашние задания", text: "Выдать, напомнить, увидеть выполнение и ответ клиента" },
  { icon: "mood", title: "Дневник настроения", text: "Быстрый чек-ин клиента и график динамики за период" },
  { icon: "balance", title: "Колесо баланса", text: "Сферы жизни в одной картинке — точка старта для разговора" },
  { icon: "bell", title: "Напоминания", text: "О встрече и о заданиях — в Telegram, без вашего участия" },
  { icon: "compass", title: "Каталог специалистов", text: "Анкета с проверкой, фильтры по запросу, методу и цене" },
  { icon: "chart", title: "Деньги и загрузка", text: "Сколько сессий, сколько дохода, где провисает неделя" },
];

const AUDIENCE: { icon: IconName; who: string; tone: string; edge: string; points: string[] }[] = [
  {
    icon: "therapy", who: "Психологу", tone: "var(--green-soft)", edge: "var(--green-edge)",
    points: [
      "Практика перестаёт жить в блокноте и переписках",
      "Запись, напоминания и переносы — без ручной работы",
      "Видно динамику клиента, а не только последнюю встречу",
      "Проверенная анкета в каталоге приводит новых людей",
    ],
  },
  {
    icon: "heart", who: "Клиенту", tone: "var(--purple-soft)", edge: "var(--purple-edge)",
    points: [
      "Подобрать специалиста по своему запросу и бюджету",
      "Записаться в свободное окно за пару касаний",
      "Отмечать состояние и видеть, как оно меняется",
      "Практики для трудного момента — бесплатно и без записи",
    ],
  },
];

export function DesktopLandingIntro() {
  return (
    <div className="hidden md:block">
      <span className="chip" style={{ background: "var(--green-soft)", color: "var(--green-edge)" }}>
        <Icon name="check" width={12} weight="bold" color="var(--green-edge)" /> Работает в Telegram
      </span>
      <h1 className="font-tight mt-4 text-[52px] font-black leading-[1.02] tracking-[-0.02em]">
        Практика психолога,<br />собранная в одном месте
      </h1>
      <p className="mt-4 max-w-[520px] text-[17px] font-semibold leading-relaxed text-[var(--muted)]">
        {APP_NAME} — платформа для психологов и их клиентов. Расписание, карточки клиентов,
        домашние задания и динамика состояния живут вместе, а не в семи разных приложениях.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <a href={BOT_URL} target="_blank" rel="noreferrer" className="btn btn-accent px-6 py-3.5 text-[14px]">
          <Icon name="telegram" width={17} weight="bold" color="#fff" /> Открыть в Telegram
        </a>
        <a href="#features" className="btn btn-white px-6 py-3.5 text-[14px]">Что внутри</a>
      </div>

      <p className="t-cap mt-4 max-w-[420px] leading-relaxed">
        Справа — живое демо на тестовых данных. Можно нажимать: ничего не сломается,
        данные остаются в вашем браузере.
      </p>

      <div className="mt-9 max-w-[520px] space-y-2">
        {HERO_POINTS.map((point) => (
          <div key={point.title} className="card-soft flex items-center gap-3 p-3.5" style={{ background: "var(--surface)" }}>
            <span className="ico h-10 w-10 shrink-0" style={{ background: "#fff" }}>
              <Icon name={point.icon} width={19} weight="bold" color="var(--edge)" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-black leading-tight">{point.title}</span>
              <span className="block text-[12.5px] font-semibold text-[var(--muted)]">{point.text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const HERO_POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "calendar", title: "Расписание и запись", text: "Клиент сам занимает свободное окно" },
  { icon: "pulse", title: "Динамика между встречами", text: "Настроение, задания, колесо баланса" },
  { icon: "compass", title: "Каталог с проверкой", text: "Анкету смотрят руками, а не алгоритмом" },
];

export function DesktopLandingBody() {
  return (
    <div className="hidden md:block">
      <div className="mx-auto max-w-[1180px] px-8 pb-24">
        <Section id="features" eyebrow="Зачем это нужно" title="Четыре вещи, ради которых платформу заводят">
          <div className="grid grid-cols-2 gap-4">
            {VALUE.map((item, i) => (
              <Rise key={item.title} delay={i * 0.05}>
                <article className="chunk flex h-full flex-col p-6" style={{ background: item.tone }}>
                  <span className="ico h-12 w-12 shrink-0" style={{ background: "#fff" }}>
                    <Icon name={item.icon} width={24} weight="bold" color={item.edge} />
                  </span>
                  <h3 className="font-tight mt-4 text-[21px] font-black leading-tight">{item.title}</h3>
                  <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[var(--muted)]">{item.text}</p>
                </article>
              </Rise>
            ))}
          </div>
        </Section>

        <Section eyebrow="Функции" title="Что уже работает">
          <div className="grid grid-cols-4 gap-3">
            {FEATURES.map((item, i) => (
              <Rise key={item.title} delay={i * 0.03}>
                <div className="card-soft flex h-full flex-col p-4" style={{ background: "var(--surface)" }}>
                  <span className="ico h-10 w-10 shrink-0" style={{ background: "#fff" }}>
                    <Icon name={item.icon} width={19} weight="bold" color="var(--edge)" />
                  </span>
                  <p className="font-tight mt-3 text-[15px] font-black leading-tight">{item.title}</p>
                  <p className="mt-1.5 text-[12.5px] font-semibold leading-snug text-[var(--muted)]">{item.text}</p>
                </div>
              </Rise>
            ))}
          </div>
        </Section>

        <Section eyebrow="Для кого" title="Две стороны одной встречи">
          <div className="grid grid-cols-2 gap-4">
            {AUDIENCE.map((item, i) => (
              <Rise key={item.who} delay={i * 0.06}>
                <article className="chunk h-full p-6" style={{ background: item.tone }}>
                  <div className="flex items-center gap-3">
                    <span className="ico h-11 w-11 shrink-0" style={{ background: "#fff" }}>
                      <Icon name={item.icon} width={21} weight="bold" color={item.edge} />
                    </span>
                    <h3 className="font-tight text-[22px] font-black">{item.who}</h3>
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white">
                          <Icon name="check" width={12} weight="bold" color={item.edge} />
                        </span>
                        <span className="text-[14px] font-semibold leading-snug">{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Rise>
            ))}
          </div>
        </Section>

        {/* Честно про десктоп: полноценной веб-версии пока нет, и обещать её
            «вот-вот» хуже, чем сразу отправить туда, где всё работает. */}
        <Rise>
          <section className="mt-20 overflow-hidden rounded-[27px] bg-[var(--ink)] text-white">
            <div className="flex items-center gap-10 p-10">
              <div className="min-w-0 flex-1">
                <span className="chip uppercase" style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}>
                  <Icon name="clock" width={12} weight="bold" color="#fff" /> В разработке
                </span>
                <h2 className="font-tight mt-4 text-[34px] font-black leading-[1.06]">
                  Десктопная версия пока в работе
                </h2>
                <p className="mt-3 max-w-[560px] text-[15px] font-semibold leading-relaxed text-white/75">
                  Полноценный кабинет для браузера мы ещё собираем. Всё, что вы видите справа,
                  уже работает — в Telegram, на телефоне и в десктопном клиенте. Открывайте бота
                  и заходите: регистрация занимает одно касание, ничего устанавливать не нужно.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href={BOT_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-[15px] bg-white px-7 py-3.5 text-[15px] font-black text-[var(--ink)] transition-transform duration-200 hover:scale-[1.02] active:scale-[.98]"
                  >
                    <Icon name="telegram" width={18} weight="bold" color="var(--ink)" /> Перейти в бота
                  </a>
                  <span className="text-[13px] font-bold text-white/55">t.me/murpsybot</span>
                </div>
              </div>
              <span className="ico hidden h-28 w-28 shrink-0 lg:flex" style={{ background: "rgba(255,255,255,.14)" }}>
                <Icon name="telegram" width={54} weight="bold" color="#fff" />
              </span>
            </div>
          </section>
        </Rise>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6" style={{ borderColor: "var(--edge-neutral)" }}>
          <p className="text-[12.5px] font-semibold text-[var(--muted-2)]">
            {APP_NAME} · {TAGLINE.toLowerCase()}. Создано в центре{" "}
            <a href={CENTER_URL} target="_blank" rel="noreferrer" className="font-black text-[var(--muted)] underline">{CENTER}</a>.
          </p>
          <p className="text-[12.5px] font-semibold text-[var(--muted-2)]">
            Платформа не оказывает экстренную и медицинскую помощь.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-20 scroll-mt-8">
      <p className="text-[12px] font-black uppercase tracking-[.1em] text-[var(--muted-2)]">{eyebrow}</p>
      <h2 className="font-tight mt-2 max-w-[720px] text-[34px] font-black leading-[1.08] tracking-[-0.015em]">{title}</h2>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function Rise({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
