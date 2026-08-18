"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowGlyph } from "@/components/blocks";
import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Icon, type IconName } from "@/components/icons";
import { ProCta } from "@/components/pro-sell";
import { Disclosure } from "@/components/ui";
import { crossedPrice, FREE_CLIENT_LIMIT, getSubscription, monthlyPrice, paidDaysLeft, PLAN_PRICE, rub, startSubscription, TRIAL_DAYS, trialDaysLeft, trialWindowLeft, type PlanId, type Subscription } from "@/lib/subscription";
import { tap } from "@/lib/haptics";

import { zoneFormat } from "@/lib/zone";

const dF = zoneFormat({ day: "numeric", month: "long" });

type Plan = { id: PlanId; name: string; tag: string; perks: string[]; best?: boolean };
const PSY_PLANS: Plan[] = [
  {
    id: "pro",
    name: "Хроника PRO",
    tag: "клиенты без лимита",
    best: true,
    perks: [
      `Клиенты без лимита (бесплатно — ${FREE_CLIENT_LIMIT}, со всем функционалом)`,
      "Подтверждение любой новой записи — из каталога, из «Терапии», по ссылке",
      "Комиссии за запись нет",
      "Анкета в каталоге и весь функционал по клиенту — бесплатно и без подписки",
    ],
  },
];

const BFrame = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[136px] flex-col justify-center gap-2 rounded-[14px] p-3" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>{children}</div>
);
const NewTag = () => <span className="rounded-full bg-[var(--coral)] px-1.5 py-0.5 text-[8px] font-black uppercase" style={{ border: "1px solid var(--coral-edge)" }}>ново</span>;

// Что входит в бесплатную версию, а что — в PRO.
const COMPARE: { label: string; free: boolean | string; pro: boolean | string }[] = [
  { label: "Добавление клиентов", free: `до ${FREE_CLIENT_LIMIT}`, pro: "без лимита" },
  { label: "Подтверждение новых записей", free: `до ${FREE_CLIENT_LIMIT}`, pro: true },
  { label: "Прямая запись на сессию", free: `до ${FREE_CLIENT_LIMIT}`, pro: "без лимита" },
  { label: "Работа с карточкой клиента", free: `до ${FREE_CLIENT_LIMIT}`, pro: true },
  { label: "Продвинутые модули", free: false, pro: true },
];

function CompareCell({ value }: { value: boolean | string }) {
  if (value === true) return <Icon name="check" width={15} weight="bold" color="var(--green-edge)" />;
  if (value === false) return <Icon name="close" width={13} weight="bold" color="var(--coral-edge)" />;
  // «без лимита» переносится на две строки — держим их по центру колонки.
  return <span className="block w-full text-center text-[10px] font-black leading-tight">{value}</span>;
}

// Компактная таблица сравнения «Бесплатно / PRO».
function FreeVsPro({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[14px] bg-white ${compact ? "" : "stroke-lg"}`} style={compact ? { border: "var(--bw) solid var(--purple-edge)" } : undefined}>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2" style={{ background: "var(--surface-2)", borderBottom: "var(--bw) solid var(--edge-neutral)" }}>
        <span className="text-[10px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Возможность</span>
        <span className="w-14 text-center text-[10px] font-black uppercase text-[var(--muted)]">Free</span>
        <span className="flex w-14 items-center justify-center gap-0.5 text-center text-[10px] font-black uppercase text-[var(--ink)]"><Icon name="spark" width={10} weight="fill" />PRO</span>
      </div>
      {COMPARE.map((row, i) => (
        <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2" style={i > 0 ? { borderTop: "1.5px solid var(--edge-neutral)" } : undefined}>
          <span className="text-[11.5px] font-bold leading-tight">{row.label}</span>
          <span className="flex w-14 justify-center"><CompareCell value={row.free} /></span>
          <span className="flex w-14 justify-center rounded-[8px] py-1" style={{ background: "var(--purple-soft)" }}><CompareCell value={row.pro} /></span>
        </div>
      ))}
    </div>
  );
}

/**
 * Как устроен тариф — по шагам, в порядке, в котором человек с этим
 * столкнётся. Пишем прямо: место в каталоге бесплатное, пробные дни даются
 * всем и один раз, деньги начинаются на четвёртом клиенте.
 */
const HOW_IT_WORKS: { icon: IconName; title: ReactNode; text: string }[] = [
  {
    icon: "users",
    title: "Пользуйтесь сразу бесплатно",
    text: `Размещение в каталоге после верификации. Заведите ${FREE_CLIENT_LIMIT} клиентов со всем функционалом без комиссий.`,
  },
  {
    icon: "seal",
    title: `${TRIAL_DAYS} дней PRO в подарок после верификации`,
    text: "Пробные дни получает каждый с момента подтверждения профиля. Ограничений на добавление клиентов и использование платформы нет.",
  },
  {
    icon: "compass",
    title: <>Место в каталоге — <span style={{ color: "var(--purple-edge)" }}>бесплатно</span> навсегда</>,
    text: "Место и рейтинг не повышается за деньги. Повышайте оценки с помощью клиентов, с кем провели хотя бы одну сессию на платформе. Неактивные профили, кто не пользуется платформой, будут падать в выдаче.",
  },
  {
    icon: "clock",
    title: "Что будет после пробного периода?",
    text: `Анкета не пропадает, но полноценно работать можно с ${FREE_CLIENT_LIMIT} клиентами на выбор.`,
  },
  {
    icon: "check",
    title: "Оформите подписку, чтобы вести больше клиентов",
    text: `Подписка снимает лимит: заводите сколько угодно клиентов и подтверждайте любые записи — не важно, пришёл человек из каталога, из «Терапии» или по вашей ссылке. Первые ${FREE_CLIENT_LIMIT} остаются бесплатными, комиссии с ваших сессий нет.`,
  },
];

function HowItWorks() {
  return (
    <div className="overflow-hidden rounded-[16px] bg-white" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: "var(--surface-2)", borderBottom: "var(--bw) solid var(--edge-neutral)" }}>
        <Icon name="question" width={13} weight="bold" color="var(--muted)" />
        <span className="text-[10px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Как это устроено?</span>
      </div>
      <ol className="p-3.5">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={i} className="relative flex gap-3 pb-3.5 last:pb-0">
            {/* Линия между шагами: список читается как путь, а не как набор
                отдельных плашек. */}
            {i < HOW_IT_WORKS.length - 1 && <span className="absolute left-[13px] top-8 bottom-1 w-[1.5px]" style={{ background: "var(--edge-neutral)" }} />}
            <span className="relative z-[1] flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>
              <Icon name={step.icon} width={13} weight="bold" color="var(--purple-edge)" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-black leading-tight">{step.title}</span>
              <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-[var(--muted)]">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      {/* Просьба поддержать стоит отдельно и на мягкой заливке: это не правило
          тарифа, а разговор о том, зачем платить, когда можно не платить. */}
      <div className="border-t p-3.5" style={{ borderColor: "var(--edge-neutral)", background: "var(--tiffany-soft)" }}>
        <div className="flex items-start gap-2.5">
          <span className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] bg-white" style={{ border: "var(--bw) solid var(--tiffany-edge)" }}>
            <Icon name="heart" width={13} weight="fill" color="var(--tiffany-edge)" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black leading-tight">Поддержите развитие платформы</p>
            <p className="mt-1 text-[11px] font-semibold leading-snug text-[var(--muted)]">Оформляя подписку, вы поможете нам улучшать платформу и делать её популярной. Мы искренне хотим создать лидирующую площадку, где каждый сможет успешно и качественно оказывать психологическую помощь. Спасибо вам!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PRO_BENEFITS: HelpPage[] = [
  { title: "Что бесплатно, а что в PRO", text: "Запись, график и первые карточки клиентов — бесплатно навсегда. PRO добавляет то, что экономит время на каждой сессии: статистику, сводку недели и шаблоны.", illo: (
    <div className="rounded-[14px] p-1" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}><FreeVsPro compact /></div>
  ) },
  { title: "Вся практика в одном месте", text: "Расписание, клиенты, записи и домашние задания рядом. Меньше рутины — больше времени на работу с людьми.", illo: (
    <BFrame>{["10:00 · Марина · онлайн", "15:00 · свободное окно", "19:00 · Алёна · очно"].map((t, i) => (
      <div key={t} className="flex items-center gap-2 rounded-[9px] bg-white px-2.5 py-1.5 text-[10px] font-bold" style={{ border: `var(--bw) solid ${["var(--purple-edge)", "var(--edge-neutral)", "var(--green-edge)"][i]}` }}>{t}</div>
    ))}</BFrame>
  ) },
  { title: "Новые инструменты каждый месяц", text: "Мы добавляем методики по научным подходам — колесо баланса, WHO-5, дневники мыслей. Всё уже включено в подписку.", illo: (
    <BFrame>{[["Колесо баланса", true], ["Дневник мыслей КПТ", true], ["Шкала тревоги GAD-7", false]].map(([t, isNew]) => (
      <div key={t as string} className="flex items-center gap-2 rounded-[9px] bg-white px-2.5 py-1.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-[var(--purple)]" style={{ border: "1px solid var(--purple-edge)" }}><Icon name="spark" width={11} weight="bold" /></span>
        <span className="flex-1 text-[10px] font-black">{t}</span>{isNew && <NewTag />}
      </div>
    ))}</BFrame>
  ) },
  { title: "Клиент включён между сессиями", text: "Интерактивные трекеры повышают вовлечённость: клиент отмечает настроение и собирает колесо баланса — а вы видите это в его карточке.", illo: (
    <BFrame><div className="flex justify-center gap-1.5">{["😞", "😕", "😐", "🙂", "😄"].map((f, i) => <span key={i} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[18px]" style={{ background: i === 3 ? "var(--ink)" : `var(--mood-${i + 1})`, border: `var(--bw) solid ${i === 3 ? "var(--ink)" : "rgba(32,28,24,.4)"}` }}>{f}</span>)}</div><p className="text-center text-[10px] font-black text-[var(--muted)]">клиент отмечает состояние сам</p></BFrame>
  ) },
  { title: "Прогресс виден обоим", text: "Прогресс-бар и динамика показывают состояние клиента от встречи к встрече — удобно обсуждать изменения и удерживать в терапии.", illo: (
    <BFrame>{[["Тревога", 40, "var(--coral)"], ["Настроение", 72, "var(--green)"], ["Баланс", 61, "var(--purple)"]].map(([label, w, c]) => (
      <div key={label as string} className="flex items-center gap-2"><span className="w-16 text-[9px] font-bold text-[var(--muted)]">{label}</span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.7 }} style={{ background: c as string }} /></div></div>
    ))}</BFrame>
  ) },
  { title: "Профиль появляется в каталоге", text: "Место в каталоге бесплатное и остаётся за вами всегда — карточка не снимается ни через месяц, ни когда кончится подписка. Купить строчку выше нельзя: в выдаче поднимаются те, кто чаще заходит и отвечает на записи.", illo: (
    <BFrame>
      <div className="flex items-center gap-2 rounded-[9px] bg-[var(--green-soft)] px-2.5 py-2" style={{ border: "var(--bw) solid var(--green-edge)" }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white" style={{ border: "1px solid var(--green-edge)" }}><Icon name="check" width={15} weight="bold" /></span>
        <span className="flex-1 text-[10px] font-black">Профиль опубликован</span>
        <span className="text-[8px] font-black uppercase text-[var(--muted)]">на равных</span>
      </div>
      {["Совпадение с запросом", "Рейтинг после сессий"].map((t) => <div key={t} className="rounded-[9px] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>{t}</div>)}
    </BFrame>
  ) },
];

// Миниатюра-баннер: свёрнутая — витрина тарифа, раскрытая — что бесплатно,
// что в подписке, и сам блок оплаты.
// Что сказать про тариф прямо под заголовком PRO. Три состояния и ничего
// больше: новичку — что сделать ради подарка, работающей подписке — статус и
// остаток дней, закончившейся — статус и предложение.
type Pitch = { status?: "on" | "off"; lines: string[] };

function bannerPitch(sub: Subscription | undefined): Pitch {
  if (!sub) return { lines: [`Клиенты без лимита, когда бесплатные ${FREE_CLIENT_LIMIT} места заняты.`] };
  if (sub.status === "pending") return { lines: ["Ждём подтверждение платежа."] };
  // Подписка работает: пробные дни после верификации, оплата или подарок из
  // админки — для человека это одно и то же состояние.
  if (sub.status === "active" || sub.status === "trial") {
    const left = sub.status === "active" ? paidDaysLeft(sub) : trialDaysLeft(sub);
    return {
      status: "on",
      lines: left > 0 ? [`Осталось ${left} ${plural(left, "день", "дня", "дней")}`] : ["Период продлевается автоматически"],
    };
  }
  if (sub.status === "free") {
    return { lines: [`Заполните профиль и пройдите верификацию, чтобы получить ${TRIAL_DAYS} дней без лимитов.`] };
  }
  return { status: "off", lines: ["Оформите подписку, чтобы расширить возможности."] };
}

// Строка состояния под заголовком: «Статус: активна» и остаток дней.
function PitchLines({ pitch }: { pitch: Pitch }) {
  return (
    <span className="mt-0.5 block">
      {pitch.status && (
        <span className="block text-[12px] font-black leading-snug">
          Статус:{" "}
          <span style={{ color: pitch.status === "on" ? "var(--green-edge)" : "var(--muted)" }}>
            {pitch.status === "on" ? "активна" : "неактивна"}
          </span>
        </span>
      )}
      {pitch.lines.map((line) => <span key={line} className="t-sub block">{line}</span>)}
    </span>
  );
}

/**
 * Данные о подписке одной карточкой: в каком она состоянии, сколько дней
 * осталось и что это значит на практике. До этого состояние было размазано по
 * подписи баннера — «активна» и «пробный» читались одинаково.
 */
function subState(sub: Subscription | undefined): { label: string; tone: string; days: number | null; caption: string; note: string } {
  if (!sub || sub.status === "free") {
    return {
      label: "Бесплатный тариф",
      tone: "tiffany",
      days: null,
      caption: `${FREE_CLIENT_LIMIT} клиента`,
      note: `${TRIAL_DAYS} дней PRO включатся сами в день, когда анкету одобрят.`,
    };
  }
  if (sub.status === "pending") {
    return { label: "Ждём оплату", tone: "amber", days: null, caption: "минуту", note: "Подтверждение платежа обычно занимает пару секунд." };
  }
  if (sub.status === "trial") {
    const d = trialDaysLeft(sub);
    return { label: "Пробный PRO", tone: "purple", days: d, caption: plural(d, "день", "дня", "дней"), note: "Пользуйтесь всеми функциями платформы без ограничений." };
  }
  if (sub.status === "active") {
    const left = paidDaysLeft(sub);
    return {
      label: "PRO активна",
      tone: "green",
      days: left > 0 ? left : null,
      caption: left > 0 ? plural(left, "день", "дня", "дней") : "продлевается",
      note: sub.currentPeriodEnd ? `Оплачено до ${dF.format(new Date(sub.currentPeriodEnd))}.` : "Период продлевается автоматически.",
    };
  }
  return {
    label: "Пробные дни вышли",
    tone: "amber",
    days: null,
    caption: `${FREE_CLIENT_LIMIT} клиента`,
    note: `Анкета осталась в каталоге, ${FREE_CLIENT_LIMIT} клиента работают как раньше.`,
  };
}

function SubStatusCard({ sub }: { sub: Subscription | undefined }) {
  const state = subState(sub);
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-white p-3">
      <span className="flex min-w-[54px] shrink-0 flex-col items-center rounded-[12px] px-2.5 py-1.5" style={{ background: `var(--${state.tone}-soft)` }}>
        {state.days !== null ? (
          <span className="tnum font-tight text-[22px] font-black leading-none" style={{ color: `var(--${state.tone}-edge)` }}>{state.days}</span>
        ) : (
          <Icon name="seal" width={19} weight="fill" color={`var(--${state.tone}-edge)`} />
        )}
        <span className="mt-0.5 text-[9px] font-black uppercase tracking-[.05em]" style={{ color: `var(--${state.tone}-edge)` }}>{state.caption}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-black leading-tight">{state.label}</p>
        <p className="t-cap mt-0.5 leading-snug">{state.note}</p>
      </div>
    </div>
  );
}

// Оплаченный PRO. Тому, кто уже платит, витрина тарифа не нужна: он приходит
// сюда за одним — сколько осталось и что у него включено.
const ACTIVE_PERKS: { icon: IconName; label: string }[] = [
  { icon: "users", label: "Клиенты без лимита" },
  { icon: "check", label: "Любые записи подтверждаются" },
  { icon: "chart", label: "Статистика и сводки" },
  { icon: "spark", label: "Новые инструменты" },
];

function ProActiveCard({ sub }: { sub: Subscription }) {
  const left = paidDaysLeft(sub);
  const until = sub.currentPeriodEnd ? dF.format(new Date(sub.currentPeriodEnd)) : null;

  return (
    <section className="overflow-hidden rounded-[20px]" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>
      <div className="relative flex items-center gap-3 px-4 pt-4">
        <ProGlow />
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--purple)" }}>
          <Icon name="seal" width={22} weight="fill" color="var(--purple-edge)" />
        </span>
        <div className="relative min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="t-head">Хроника PRO</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[.04em]" style={{ background: "var(--green-soft)", color: "var(--green-edge)" }}>активна</span>
          </div>
          <p className="mt-0.5 text-[12px] font-black leading-snug">
            Статус: <span style={{ color: "var(--green-edge)" }}>активна</span>
          </p>
          <p className="t-sub block">
            {left > 0 ? `Осталось ${left} ${plural(left, "день", "дня", "дней")}` : "Период продлевается автоматически"}
          </p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 rounded-[14px] bg-white p-3">
          {left > 0 ? (
            <span className="flex shrink-0 flex-col items-center rounded-[11px] px-3 py-1.5" style={{ background: "var(--purple-soft)" }}>
              <span className="tnum font-tight text-[22px] font-black leading-none">{left}</span>
              <span className="text-[9px] font-black uppercase tracking-[.06em] text-[var(--muted)]">{plural(left, "день", "дня", "дней")}</span>
            </span>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px]" style={{ background: "var(--purple-soft)" }}>
              <Icon name="check" width={18} weight="bold" color="var(--purple-edge)" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[12.5px] font-black leading-tight">{until ? `Оплачено до ${until}` : "Доступ открыт"}</p>
            <p className="t-cap mt-0.5">{left > 0 ? "Столько осталось от оплаченного периода" : "Период продлевается"}</p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {ACTIVE_PERKS.map((perk) => (
            <div key={perk.label} className="flex items-center gap-2 rounded-[12px] bg-white px-2.5 py-2">
              <Icon name={perk.icon} width={14} weight="bold" color="var(--purple-edge)" className="shrink-0" />
              <span className="text-[11px] font-black leading-tight">{perk.label}</span>
            </div>
          ))}
        </div>

        <p className="mt-2.5 text-center text-[10px] font-semibold text-[var(--muted-2)]">Оплата прошла через ЮKassa · спасибо, что поддерживаете Хронику</p>
      </div>
    </section>
  );
}

/**
 * Фон шапки баннера справа: рядом с ценой оставалось пустое место, и блок
 * читался недоделанным. Кольца медленно дышат, искры всплывают — движение
 * фоновое, текст перекрывает его сверху. При `prefers-reduced-motion` замирает.
 */
function ProGlow() {
  const reduce = useReducedMotion();
  const sparks = [
    { right: 16, top: "18%", size: 14, delay: 0 },
    { right: 54, top: "46%", size: 9, delay: 0.9 },
    { right: 28, top: "72%", size: 7, delay: 1.7 },
  ];
  return (
    <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[142px] overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, #000 48%)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 48%)" }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ right: -36 - i * 12, top: "50%", height: 92 + i * 36, width: 92 + i * 36, marginTop: -(46 + i * 18), border: "1.5px solid var(--purple-edge)", opacity: 0.24 - i * 0.06 }}
          animate={reduce ? undefined : { scale: [1, 1.07, 1] }}
          transition={{ duration: 4.5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
        />
      ))}
      {sparks.map((sp) => (
        <motion.span
          key={sp.delay}
          className="absolute"
          style={{ right: sp.right, top: sp.top, opacity: 0.65 }}
          animate={reduce ? undefined : { y: [0, -7, 0], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: sp.delay }}
        >
          <Icon name="spark" width={sp.size} weight="fill" color="var(--purple-edge)" />
        </motion.span>
      ))}
    </span>
  );
}

export function SubscriptionBanner() {
  const [open, setOpen] = useState(false);
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const rows = COMPARE;
  const title = "Хроника PRO";
  const price = monthlyPrice(sub);
  const crossed = crossedPrice(sub);
  const pitch = bannerPitch(sub);

  if (sub?.status === "active") return <ProActiveCard sub={sub} />;

  return (
    <div className="overflow-hidden rounded-[20px]" style={{ background: "var(--purple-soft)" }}>
      <div className="relative flex items-center gap-3 p-4">
        <ProGlow />
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--purple)" }}>
          <Icon name="spark" width={22} weight="fill" color="var(--purple-edge)" />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="t-head">{title}</span>
            {/* Скидка за отказ в каталоге: старую цену перечёркиваем, чтобы
                разница читалась без пояснений. */}
            {crossed && <span className="tnum text-[11px] font-bold text-[var(--muted-2)] line-through">{rub(crossed)}</span>}
            <span className="tnum text-[12.5px] font-black" style={{ color: "var(--purple-edge)" }}>{rub(price)}/мес</span>
          </span>
          <PitchLines pitch={pitch} />
        </span>
      </div>

      {/* Раскрытие подписано словами: «стрелочка» справа не говорила, что за
          ней прячется сравнение тарифов. */}
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-2 px-4 pb-3 text-left" aria-expanded={open}>
        <span className="text-[12.5px] font-black" style={{ color: "var(--purple-edge)" }}>Что входит в подписку?</span>
        {/* Чёрный круг рядом читался как кнопка оплаты — теперь просто стрелка
            в цвете подписки. */}
        <span
          className="transition-transform duration-300"
          style={{ color: "var(--purple-edge)", transform: open ? "rotate(-90deg)" : "rotate(90deg)" }}
        >
          <ArrowGlyph size={16} />
        </span>
      </button>

      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} style={{ transitionTimingFunction: "var(--ease-out)" }} aria-hidden={!open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4">
            <div className="mb-3"><SubStatusCard sub={sub} /></div>
            <div className="rounded-[14px] bg-white p-3">
              <div className="mb-1.5 grid grid-cols-[1fr_auto_auto] items-center gap-x-3">
                <span className="t-micro">Что входит</span>
                <span className="t-micro w-14 text-center">Free</span>
                <span className="t-micro w-14 text-center" style={{ color: "var(--purple-edge)" }}>PRO</span>
              </div>
              {rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t py-2" style={{ borderColor: "var(--edge-neutral)" }}>
                  <span className="t-cap" style={{ color: "var(--ink)" }}>{row.label}</span>
                  <span className="flex w-14 justify-center"><CompareCell value={row.free} /></span>
                  <span className="flex w-14 justify-center"><CompareCell value={row.pro} /></span>
                </div>
              ))}
            </div>
            <div className="mt-3"><HowItWorks /></div>
            <div className="mt-3"><ProCta label="Подключить" note={false} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionBlock({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription, refetchInterval: (q) => (q.state.data?.status === "pending" ? 1500 : false) });
  const [benefits, setBenefits] = useState(false);
  const subscribe = useMutation({ mutationFn: (plan: PlanId) => startSubscription(plan), onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; else qc.invalidateQueries({ queryKey: ["subscription"] }); } });

  if (!sub) return <div className="skeleton h-40" />;
  const pending = sub.status === "pending";

  const hero = psyHero(sub);
  const perks: { icon: IconName; label: string }[] = [
    { icon: "calendar", label: "Удобная работа" },
    { icon: "spark", label: "Обновления методик" },
    { icon: "heart", label: "Вовлечённость" },
    { icon: "chart", label: "Прогресс клиента" },
  ];

  const paid = sub.status === "active";
  const shownPlans: Plan[] = paid ? [] : PSY_PLANS;

  // compact — блок живёт внутри баннера, который уже показал шапку и сравнение.
  if (compact) {
    return (
      <div className="space-y-2.5">
        {pending ? (
          <p className="py-2 text-center text-[13px] font-bold text-[var(--muted)]">Ждём подтверждение платежа…</p>
        ) : (
          <>
            {shownPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onPick={() => subscribe.mutate(plan.id)} loading={subscribe.isPending} defaultOpen={plan.best || shownPlans.length === 1} price={monthlyPrice(sub)} crossed={crossedPrice(sub)} />)}
            <p className="pt-1 text-center text-[10px] font-semibold text-[var(--muted-2)]">Оплата через ЮKassa · отмена в любой момент · годовая оплата — 2 месяца в подарок</p>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[22px]" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
      <div className="relative p-5" style={{ background: "linear-gradient(150deg, var(--purple) 0%, var(--purple-soft) 100%)" }}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1 text-[11px] font-black text-white"><Icon name="seal" width={14} weight="fill" color="var(--amber-soft)" /> МЕТОДИКА PRO</span>
          {hero.badge}
        </div>
        <div className="mt-3">
          <h3 className="font-tight text-[22px] font-black leading-tight">{hero.title}</h3>
          <p className="mt-1 text-[12px] font-bold text-[var(--muted)]">{hero.subtitle}</p>
          {hero.progress}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {perks.map((p) => (
            <div key={p.label} className="flex items-center gap-2 rounded-[11px] bg-[#ffffff] px-2.5 py-2" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
              <Icon name={p.icon} width={15} weight="bold" /><span className="text-[11px] font-black leading-tight">{p.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { tap(); setBenefits(true); }} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[13px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white">
          <Icon name="spark" width={15} weight="fill" /> Смотреть возможности
        </button>
      </div>

      <div className="space-y-2.5 bg-[var(--surface)] p-4">
        {pending ? (
          <p className="py-2 text-center text-[13px] font-bold text-[var(--muted)]">Ждём подтверждение платежа…</p>
        ) : (
          <>
            {!paid && <div className="space-y-1.5"><p className="px-1 text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Что входит</p><FreeVsPro /></div>}
            <HowItWorks />
            {shownPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onPick={() => subscribe.mutate(plan.id)} loading={subscribe.isPending} defaultOpen={plan.best || shownPlans.length === 1} price={monthlyPrice(sub)} crossed={crossedPrice(sub)} />)}
            <p className="pt-1 text-center text-[10px] font-semibold text-[var(--muted-2)]">Оплата через ЮKassa · отмена в любой момент · годовая оплата — 2 месяца в подарок</p>
          </>
        )}
      </div>

      {benefits && <HelpDeck title="Возможности Хроника PRO" pages={PRO_BENEFITS} onClose={() => setBenefits(false)} doneLabel="Выбрать тариф" onDone={() => setBenefits(false)} />}
    </section>
  );
}

function psyHero(sub: Subscription): { badge: ReactNode; title: string; subtitle: string; progress: ReactNode } {
  if (sub.status === "trial") {
    const daysLeft = Math.min(TRIAL_DAYS, trialDaysLeft(sub));
    return {
      badge: <span className="rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>🎁 Триал</span>,
      title: `${TRIAL_DAYS} дней PRO после верификации`,
      subtitle: `Клиенты без лимита, любые записи подтверждаются. Карта не нужна — осталось ${daysLeft} ${plural(daysLeft, "день", "дня", "дней")}.`,
      progress: <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#ffffff]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full bg-[var(--ink)]" initial={{ width: 0 }} animate={{ width: `${(daysLeft / TRIAL_DAYS) * 100}%` }} transition={{ duration: 0.6 }} /></div>,
    };
  }
  if (sub.status === "pending") return { badge: null, title: "Подтверждаем оплату…", subtitle: "Обычно занимает пару секунд.", progress: null };
  if (sub.status === "active") {
    const left = paidDaysLeft(sub);
    const until = sub.currentPeriodEnd ? `до ${dF.format(new Date(sub.currentPeriodEnd))}` : "автоматически";
    return { badge: <span className="rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }}>активна</span>, title: "Хроника PRO активен", subtitle: left > 0 ? `Осталось ${left} ${plural(left, "день", "дня", "дней")} — продлится ${until}.` : `Продлится ${until}.`, progress: null };
  }

  // Триал ещё не начинался: он включится сам в день, когда анкету одобрят.
  // Про это важно сказать вслух, иначе бесплатный тариф выглядит как отказ.
  if (sub.status === "free") {
    return {
      badge: <span className="rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>🎁 {TRIAL_DAYS} дней впереди</span>,
      title: "Бесплатный тариф",
      subtitle: `${FREE_CLIENT_LIMIT} клиента со всем функционалом. ${TRIAL_DAYS} дней PRO включатся сами в день, когда анкету одобрят, — их получает каждый.`,
      progress: null,
    };
  }

  const left = trialWindowLeft(sub);
  return {
    badge: <span className="rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>{rub(PLAN_PRICE.pro)}/мес</span>,
    title: "Бесплатный тариф",
    subtitle: left > 0
      ? `${FREE_CLIENT_LIMIT} клиента со всем функционалом и анкета в каталоге. PRO снимает лимит: клиентов сколько угодно.`
      : `${FREE_CLIENT_LIMIT} клиента со всем функционалом и анкета в каталоге — бесплатно. Пробные ${TRIAL_DAYS} дней вышли, PRO снимает лимит клиентов.`,
    progress: null,
  };
}

function PlanCard({ plan, onPick, loading, defaultOpen = false, price = PLAN_PRICE.pro, crossed = null }: { plan: Plan; onPick: () => void; loading: boolean; defaultOpen?: boolean; price?: number; crossed?: number | null }) {
  const best = plan.best;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="relative rounded-[16px]" style={{ background: best ? "var(--purple-soft)" : "#fff", border: `var(--bw-lg) solid ${best ? "var(--purple-edge)" : "var(--edge-neutral)"}` }}>
      {best && <span className="absolute -top-2.5 left-4 z-[1] rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[9px] font-black uppercase text-white">основной</span>}
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-2 p-3.5 text-left" aria-expanded={open}>
        <div className="flex-1"><p className="text-[15px] font-black">{plan.name}</p><p className="text-[10px] font-black uppercase tracking-[.06em] text-[var(--muted-2)]">{plan.tag}</p></div>
        <div className="text-right">{crossed && <p className="tnum text-[11px] font-bold text-[var(--muted-2)] line-through">{rub(crossed)}</p>}<p className="font-tight text-[20px] font-black leading-none">{rub(price)}</p><p className="text-[10px] font-bold text-[var(--muted)]">в месяц</p></div>
        <ArrowGlyph className="shrink-0 text-[var(--muted-2)] transition-transform" style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)" }} />
      </button>
      <Disclosure open={open}>
        <div className="px-3.5 pb-3.5">
          <ul className="space-y-1">
            {plan.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-1.5 text-[11px] font-semibold text-[var(--muted)]"><Icon name="check" width={13} weight="bold" className="mt-0.5 shrink-0" color="var(--green-edge)" />{perk}</li>
            ))}
          </ul>
          <button onClick={() => { tap(); onPick(); }} disabled={loading} className="mt-3 w-full rounded-[12px] py-2.5 text-[13px] font-black transition-transform active:scale-[0.98] disabled:opacity-50" style={best ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", border: "var(--bw) solid var(--purple-edge)" }}>
            {loading ? "Готовим оплату…" : `Подключить · ${rub(price)}/мес`}
          </button>
        </div>
      </Disclosure>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
