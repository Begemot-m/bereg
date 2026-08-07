"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowGlyph } from "@/components/blocks";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Icon, type IconName } from "@/components/icons";
import { ProCta } from "@/components/pro-sell";
import { Disclosure } from "@/components/ui";
import { CATALOG_FREE_DAYS, catalogDaysLeft, FREE_CLIENT_LIMIT, getSubscription, PLAN_PRICE, rub, startSubscription, TRIAL_DAYS, trialDaysLeft, type PlanId, type Subscription } from "@/lib/subscription";
import { tap } from "@/lib/haptics";

const dF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

type Plan = { id: PlanId; name: string; tag: string; perks: string[]; best?: boolean };
const PSY_PLANS: Plan[] = [
  {
    id: "pro",
    name: "Хроника PRO",
    tag: "безлимит + размещение",
    best: true,
    perks: [
      `Клиенты без лимита (бесплатно — ${FREE_CLIENT_LIMIT}, со всем функционалом)`,
      `Каталог специалистов дальше первых ${CATALOG_FREE_DAYS} дней — честная выдача`,
      "Комиссии за запись нет",
      "Весь функционал по клиенту доступен и бесплатно",
    ],
  },
];

const BFrame = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[136px] flex-col justify-center gap-2 rounded-[14px] p-3" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>{children}</div>
);
const NewTag = () => <span className="rounded-full bg-[var(--coral)] px-1.5 py-0.5 text-[8px] font-black uppercase" style={{ border: "1px solid var(--coral-edge)" }}>ново</span>;

// Что входит в бесплатную версию, а что — в PRO.
const COMPARE: { label: string; free: boolean | string; pro: boolean | string }[] = [
  { label: "Клиенты", free: `до ${FREE_CLIENT_LIMIT}`, pro: "без лимита" },
  { label: "Записи, график, карточки", free: true, pro: true },
  { label: "Настроение, домашки, шаблоны", free: true, pro: true },
  { label: "Аналитика и сводка недели", free: true, pro: true },
  { label: "Размещение в каталоге специалистов", free: `${CATALOG_FREE_DAYS} дней`, pro: "постоянно" },
  { label: "Комиссия за запись", free: "нет", pro: "нет" },
];

function CompareCell({ value }: { value: boolean | string }) {
  if (value === true) return <Icon name="check" width={14} weight="bold" color="var(--green-edge)" />;
  if (value === false) return <span className="text-[13px] font-black text-[var(--muted-2)]">—</span>;
  return <span className="text-[10px] font-black leading-none">{value}</span>;
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
  { title: "Профиль появляется в каталоге", text: `Первые ${CATALOG_FREE_DAYS} дней после верификации анкета стоит в каталоге бесплатно, дальше её держит PRO. Место в выдаче купить нельзя — подборки собираются по совпадению с запросом.`, illo: (
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
// Что сказать про тариф прямо в свёрнутом баннере: до оплаты человек видит
// именно эту строку, поэтому она говорит про срок, а не про список функций.
function bannerPitch(sub: Subscription | undefined): string {
  if (!sub) return "Клиенты без лимита и место в каталоге, когда бесплатные дни вышли.";
  if (sub.status === "active") return "Подписка активна — лимитов нет, карточка в каталоге.";
  if (sub.status === "pending") return "Ждём подтверждение платежа.";
  const cat = catalogDaysLeft(sub);
  if (sub.status === "trial") {
    const d = trialDaysLeft(sub);
    return `Пробный PRO: осталось ${d} ${plural(d, "день", "дня", "дней")}.`;
  }
  if (sub.status === "free") {
    return cat > 0
      ? `Каталог бесплатно ещё ${cat} ${plural(cat, "день", "дня", "дней")}. ${TRIAL_DAYS} дней PRO включатся после первой сессии.`
      : `${TRIAL_DAYS} дней PRO включатся сами после первой проведённой сессии.`;
  }
  return cat > 0
    ? `Карточка в каталоге ещё ${cat} ${plural(cat, "день", "дня", "дней")} — дальше её держит PRO.`
    : "Клиенты без лимита и место в каталоге специалистов.";
}

export function SubscriptionBanner() {
  const [open, setOpen] = useState(false);
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const rows = COMPARE;
  const title = "Хроника PRO";
  const price = PLAN_PRICE.pro;
  const pitch = bannerPitch(sub);

  return (
    <div className="overflow-hidden rounded-[20px]" style={{ background: "var(--purple-soft)" }}>
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--purple)" }}>
          <Icon name="spark" width={22} weight="fill" color="var(--purple-edge)" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="t-head">{title}</span>
            <span className="tnum text-[12.5px] font-black" style={{ color: "var(--purple-edge)" }}>{rub(price)}/мес</span>
          </span>
          <span className="t-sub mt-0.5 block">{pitch}</span>
        </span>
        <span className="arrow" style={{ transform: open ? "rotate(90deg)" : "none" }}><ArrowGlyph /></span>
      </button>

      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} style={{ transitionTimingFunction: "var(--ease-out)" }} aria-hidden={!open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4">
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
            {sub?.status !== "active" && <div className="mt-3"><ProCta label="Подключить" note={false} /></div>}
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
            {shownPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onPick={() => subscribe.mutate(plan.id)} loading={subscribe.isPending} defaultOpen={plan.best || shownPlans.length === 1} />)}
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
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1 text-[11px] font-black text-white"><Icon name="spark" width={13} weight="fill" /> МЕТОДИКА PRO</span>
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
            {shownPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onPick={() => subscribe.mutate(plan.id)} loading={subscribe.isPending} defaultOpen={plan.best || shownPlans.length === 1} />)}
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
      title: `${TRIAL_DAYS} дней бесплатно`,
      subtitle: `Полный доступ ко всем инструментам. Карта не нужна — осталось ${daysLeft} ${plural(daysLeft, "день", "дня", "дней")}.`,
      progress: <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#ffffff]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full bg-[var(--ink)]" initial={{ width: 0 }} animate={{ width: `${(daysLeft / TRIAL_DAYS) * 100}%` }} transition={{ duration: 0.6 }} /></div>,
    };
  }
  if (sub.status === "pending") return { badge: null, title: "Подтверждаем оплату…", subtitle: "Обычно занимает пару секунд.", progress: null };
  if (sub.status === "active") return { badge: <span className="rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }}>активна</span>, title: "Хроника PRO активен", subtitle: `Продлится ${sub.currentPeriodEnd ? `до ${dF.format(new Date(sub.currentPeriodEnd))}` : "автоматически"}.`, progress: null };

  // Триал ещё не начинался: он включится сам, когда пройдёт первая сессия.
  // Про это важно сказать вслух, иначе бесплатный тариф выглядит как отказ.
  if (sub.status === "free") {
    const days = catalogDaysLeft(sub);
    return {
      badge: <span className="rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>🎁 {TRIAL_DAYS} дней впереди</span>,
      title: "Бесплатный тариф",
      subtitle: days > 0
        ? `${FREE_CLIENT_LIMIT} клиента со всем функционалом, карточка в каталоге ещё ${days} ${plural(days, "день", "дня", "дней")}. ${TRIAL_DAYS} дней PRO включатся сами после первой проведённой сессии.`
        : `${FREE_CLIENT_LIMIT} клиента со всем функционалом. ${TRIAL_DAYS} дней PRO включатся сами после первой проведённой сессии.`,
      progress: null,
    };
  }

  const days = catalogDaysLeft(sub);
  return {
    badge: <span className="rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>{rub(PLAN_PRICE.pro)}/мес</span>,
    title: "Бесплатный тариф",
    subtitle: days > 0
      ? `${FREE_CLIENT_LIMIT} клиента со всем функционалом, карточка в каталоге ещё ${days} ${plural(days, "день", "дня", "дней")}. PRO снимает лимит и оставляет вас в каталоге.`
      : `${FREE_CLIENT_LIMIT} клиента со всем функционалом. PRO — клиенты без лимита и место в каталоге специалистов.`,
    progress: null,
  };
}

function PlanCard({ plan, onPick, loading, defaultOpen = false }: { plan: Plan; onPick: () => void; loading: boolean; defaultOpen?: boolean }) {
  const best = plan.best;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="relative rounded-[16px]" style={{ background: best ? "var(--purple-soft)" : "#fff", border: `var(--bw-lg) solid ${best ? "var(--purple-edge)" : "var(--edge-neutral)"}` }}>
      {best && <span className="absolute -top-2.5 left-4 z-[1] rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[9px] font-black uppercase text-white">основной</span>}
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-2 p-3.5 text-left" aria-expanded={open}>
        <div className="flex-1"><p className="text-[15px] font-black">{plan.name}</p><p className="text-[10px] font-black uppercase tracking-[.06em] text-[var(--muted-2)]">{plan.tag}</p></div>
        <div className="text-right"><p className="font-tight text-[20px] font-black leading-none">{rub(PLAN_PRICE[plan.id])}</p><p className="text-[10px] font-bold text-[var(--muted)]">в месяц</p></div>
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
            {loading ? "Готовим оплату…" : `Подключить · ${rub(PLAN_PRICE[plan.id])}/мес`}
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
