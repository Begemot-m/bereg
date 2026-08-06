"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { AUDIENCE, FEATURES, VALUE } from "@/components/landing";
import { APP_NAME, BOT_NAME, CENTER, CENTER_URL, TAGLINE, botDeepLink } from "@/lib/brand";

const BOT_URL = botDeepLink("site");

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "telegram", title: "Открыть бота с телефона", text: `Ссылка t.me/${BOT_NAME} — приложение запускается прямо внутри Telegram` },
  { icon: "lock", title: "Вход одним касанием", text: "Аккаунт Telegram и есть вход: ни паролей, ни писем, ни установки" },
  { icon: "spark", title: "Выбрать роль", text: "Психолог ведёт практику, клиент записывается и отмечает состояние" },
];

/**
 * Лендинг боевого сайта. Веб-кабинета пока нет, поэтому вместо пустого замка
 * «Откройте в Telegram» человек видит, что это за платформа и как в неё войти.
 */
export function WebLanding() {
  return (
    <div
      className="fixed inset-0 z-[95] overflow-y-auto"
      style={{ background: "radial-gradient(120% 70% at 50% -10%, #ffffff 0%, var(--bg) 55%)" }}
    >
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 pt-[max(env(safe-area-inset-top),18px)] md:px-8 md:pt-7">
        <span className="inline-flex items-center gap-2">
          <span className="stroke flex h-8 w-8 items-center justify-center rounded-[9px] text-[16px] font-black text-[var(--bg)]" style={{ background: "var(--ink)" }}>
            {APP_NAME.charAt(0)}
          </span>
          <span className="font-tight text-xl font-extrabold">{APP_NAME}</span>
        </span>
        <a href={BOT_URL} target="_blank" rel="noreferrer" className="btn btn-accent px-4 py-2.5 text-[13px]">
          <Icon name="telegram" width={15} weight="bold" color="#fff" /> В Telegram
        </a>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-5 pb-16 md:px-8 md:pb-24">
        <section className="pt-10 md:pt-16">
          <span className="chip" style={{ background: "var(--green-soft)", color: "var(--green-edge)" }}>
            <Icon name="check" width={12} weight="bold" color="var(--green-edge)" /> Работает в Telegram
          </span>
          <h1 className="font-tight mt-4 max-w-[760px] text-[34px] font-black leading-[1.05] tracking-[-0.02em] md:text-[56px]">
            Практика психолога, собранная в одном месте
          </h1>
          <p className="mt-4 max-w-[560px] text-[15px] font-semibold leading-relaxed text-[var(--muted)] md:text-[18px]">
            {APP_NAME} — платформа для психологов и их клиентов. Расписание, карточки клиентов,
            домашние задания и динамика состояния живут вместе, а не в семи разных приложениях.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href={BOT_URL} target="_blank" rel="noreferrer" className="btn btn-accent px-6 py-3.5 text-[14px]">
              <Icon name="telegram" width={17} weight="bold" color="#fff" /> Открыть в Telegram
            </a>
            <a href="#value" className="btn btn-white px-6 py-3.5 text-[14px]">Что внутри</a>
          </div>

          <div className="card-soft mt-6 flex max-w-[560px] items-start gap-3 p-4" style={{ background: "var(--surface)" }}>
            <span className="ico h-9 w-9 shrink-0" style={{ background: "#fff" }}>
              <Icon name="clock" width={17} weight="bold" color="var(--edge)" />
            </span>
            <p className="text-[13px] font-semibold leading-snug text-[var(--muted)]">
              Версия для компьютера пока в разработке. Чтобы попасть на платформу,
              откройте бота в Telegram с телефона — там уже работает всё.
            </p>
          </div>
        </section>

        <Section id="value" eyebrow="Зачем это нужно" title="Четыре вещи, ради которых платформу заводят">
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {VALUE.map((item, i) => (
              <Rise key={item.title} delay={i * 0.05}>
                <article className="chunk flex h-full flex-col p-5 md:p-6" style={{ background: item.tone }}>
                  <span className="ico h-11 w-11 shrink-0 md:h-12 md:w-12" style={{ background: "#fff" }}>
                    <Icon name={item.icon} width={22} weight="bold" color={item.edge} />
                  </span>
                  <h3 className="font-tight mt-4 text-[19px] font-black leading-tight md:text-[21px]">{item.title}</h3>
                  <p className="mt-2 text-[13.5px] font-semibold leading-relaxed text-[var(--muted)] md:text-[14px]">{item.text}</p>
                </article>
              </Rise>
            ))}
          </div>
        </Section>

        <Section eyebrow="Функции" title="Что уже работает">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {FEATURES.map((item, i) => (
              <Rise key={item.title} delay={i * 0.03}>
                <div className="card-soft flex h-full flex-col p-4" style={{ background: "var(--surface)" }}>
                  <span className="ico h-10 w-10 shrink-0" style={{ background: "#fff" }}>
                    <Icon name={item.icon} width={19} weight="bold" color="var(--edge)" />
                  </span>
                  <p className="font-tight mt-3 text-[14.5px] font-black leading-tight">{item.title}</p>
                  <p className="mt-1.5 text-[12.5px] font-semibold leading-snug text-[var(--muted)]">{item.text}</p>
                </div>
              </Rise>
            ))}
          </div>
        </Section>

        <Section eyebrow="Для кого" title="Две стороны одной встречи">
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {AUDIENCE.map((item, i) => (
              <Rise key={item.who} delay={i * 0.06}>
                <article className="chunk h-full p-5 md:p-6" style={{ background: item.tone }}>
                  <div className="flex items-center gap-3">
                    <span className="ico h-11 w-11 shrink-0" style={{ background: "#fff" }}>
                      <Icon name={item.icon} width={21} weight="bold" color={item.edge} />
                    </span>
                    <h3 className="font-tight text-[20px] font-black md:text-[22px]">{item.who}</h3>
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white">
                          <Icon name="check" width={12} weight="bold" color={item.edge} />
                        </span>
                        <span className="text-[13.5px] font-semibold leading-snug md:text-[14px]">{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Rise>
            ))}
          </div>
        </Section>

        <Section eyebrow="Как войти" title="Три шага, и вы внутри">
          <div className="grid gap-3 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Rise key={step.title} delay={i * 0.05}>
                <div className="card-soft flex h-full flex-col p-5" style={{ background: "var(--surface)" }}>
                  <div className="flex items-center gap-3">
                    <span className="ico h-10 w-10 shrink-0" style={{ background: "#fff" }}>
                      <Icon name={step.icon} width={19} weight="bold" color="var(--edge)" />
                    </span>
                    <span className="font-tight text-[26px] font-black text-[var(--muted-2)]">{i + 1}</span>
                  </div>
                  <p className="font-tight mt-3 text-[16px] font-black leading-tight">{step.title}</p>
                  <p className="mt-1.5 text-[13px] font-semibold leading-snug text-[var(--muted)]">{step.text}</p>
                </div>
              </Rise>
            ))}
          </div>
        </Section>

        {/* Честно про десктоп: веб-кабинета пока нет, и обещать его «вот-вот»
            хуже, чем сразу отправить туда, где всё работает. */}
        <Rise>
          <section className="mt-16 overflow-hidden rounded-[27px] bg-[var(--ink)] text-white md:mt-20">
            <div className="flex items-center gap-10 p-6 md:p-10">
              <div className="min-w-0 flex-1">
                <span className="chip uppercase" style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}>
                  <Icon name="clock" width={12} weight="bold" color="#fff" /> В разработке
                </span>
                <h2 className="font-tight mt-4 text-[26px] font-black leading-[1.06] md:text-[34px]">
                  Десктопная версия пока в работе
                </h2>
                <p className="mt-3 max-w-[560px] text-[14px] font-semibold leading-relaxed text-white/75 md:text-[15px]">
                  Полноценный кабинет для браузера мы ещё собираем. Всё остальное уже работает —
                  в Telegram, на телефоне. Откройте бота с мобильного: регистрация занимает одно
                  касание, устанавливать ничего не нужно.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href={BOT_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-[15px] bg-white px-6 py-3.5 text-[15px] font-black text-[var(--ink)] transition-transform duration-200 hover:scale-[1.02] active:scale-[.98]"
                  >
                    <Icon name="telegram" width={18} weight="bold" color="var(--ink)" /> Перейти в бота
                  </a>
                  <span className="text-[13px] font-bold text-white/55">t.me/{BOT_NAME}</span>
                </div>
              </div>
              <span className="ico hidden h-28 w-28 shrink-0 lg:flex" style={{ background: "rgba(255,255,255,.14)" }}>
                <Icon name="telegram" width={54} weight="bold" color="#fff" />
              </span>
            </div>
          </section>
        </Rise>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6 pb-[max(env(safe-area-inset-bottom),8px)]" style={{ borderColor: "var(--edge-neutral)" }}>
          <p className="text-[12.5px] font-semibold text-[var(--muted-2)]">
            {APP_NAME} · {TAGLINE.toLowerCase()}. Создано в центре{" "}
            <a href={CENTER_URL} target="_blank" rel="noreferrer" className="font-black text-[var(--muted)] underline">{CENTER}</a>.
          </p>
          <p className="text-[12.5px] font-semibold text-[var(--muted-2)]">
            Платформа не оказывает экстренную и медицинскую помощь.
          </p>
        </footer>
      </main>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-16 scroll-mt-8 md:mt-20">
      <p className="text-[12px] font-black uppercase tracking-[.1em] text-[var(--muted-2)]">{eyebrow}</p>
      <h2 className="font-tight mt-2 max-w-[720px] text-[26px] font-black leading-[1.08] tracking-[-0.015em] md:text-[34px]">{title}</h2>
      <div className="mt-6 md:mt-7">{children}</div>
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
