"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Icon, type IconName } from "@/components/icons";
import { getSubscription, PLAN_PRICE, rub, startSubscription, trialDaysLeft, type PlanId, type Subscription } from "@/lib/subscription";
import { tap } from "@/lib/haptics";

const dF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

type Plan = { id: PlanId; name: string; tag: string; perks: string[]; best?: boolean };
const PSY_PLANS: Plan[] = [
  { id: "tools", name: "Практика", tag: "инструменты", perks: ["Расписание, клиенты, сессии", "Домашние задания и техники", "Колесо баланса и трекеры", "Инструменты для ваших клиентов", "Новые методики каждый месяц"] },
  { id: "all", name: "Всё включено", tag: "инструменты + каталог", best: true, perks: ["Весь инструментарий «Практики»", "Подтверждённый профиль в каталоге", "Топ выдачи и бейдж «Рекомендуем»", "Статистика показов профиля"] },
];
const CLIENT_PLAN: Plan = { id: "client", name: "Вдох+", tag: "для себя", best: true, perks: ["Колесо баланса и шкала WHO-5", "Дневник эмоций и мыслей", "Дыхательные практики и медитации", "Прогресс виден вам и терапевту"] };

const BFrame = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[136px] flex-col justify-center gap-2 rounded-[16px] p-3" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>{children}</div>
);
const NewTag = () => <span className="rounded-full bg-[var(--coral)] px-1.5 py-0.5 text-[8px] font-black uppercase" style={{ border: "1px solid var(--coral-edge)" }}>ново</span>;

export const PRO_BENEFITS: HelpPage[] = [
  { title: "Вся практика в одном месте", text: "Расписание, клиенты, записи и домашние задания рядом. Меньше рутины — больше времени на работу с людьми.", illo: (
    <BFrame>{["10:00 · Марина · онлайн", "15:00 · свободное окно", "19:00 · Алёна · очно"].map((t, i) => (
      <div key={t} className="flex items-center gap-2 rounded-[10px] bg-white px-2.5 py-1.5 text-[10px] font-bold" style={{ border: `var(--bw) solid ${["var(--purple-edge)", "var(--edge-neutral)", "var(--green-edge)"][i]}` }}>{t}</div>
    ))}</BFrame>
  ) },
  { title: "Новые инструменты каждый месяц", text: "Мы добавляем методики по научным подходам — колесо баланса, WHO-5, дневники мыслей. Всё уже включено в подписку.", illo: (
    <BFrame>{[["Колесо баланса", true], ["Дневник мыслей КПТ", true], ["Шкала тревоги GAD-7", false]].map(([t, isNew]) => (
      <div key={t as string} className="flex items-center gap-2 rounded-[10px] bg-white px-2.5 py-1.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-[var(--purple)]" style={{ border: "1px solid var(--purple-edge)" }}><Icon name="spark" width={11} weight="bold" /></span>
        <span className="flex-1 text-[10px] font-black">{t}</span>{isNew && <NewTag />}
      </div>
    ))}</BFrame>
  ) },
  { title: "Клиент включён между сессиями", text: "Интерактивные трекеры повышают вовлечённость: клиент отмечает настроение и собирает колесо баланса — а вы видите это в его карточке.", illo: (
    <BFrame><div className="flex justify-center gap-1.5">{["😞", "😕", "😐", "🙂", "😄"].map((f, i) => <span key={i} className="flex h-9 w-9 items-center justify-center rounded-[11px] text-[18px]" style={{ background: i === 3 ? "var(--ink)" : `var(--mood-${i + 1})`, border: `var(--bw) solid ${i === 3 ? "var(--ink)" : "rgba(32,28,24,.4)"}` }}>{f}</span>)}</div><p className="text-center text-[10px] font-black text-[var(--muted)]">клиент отмечает состояние сам</p></BFrame>
  ) },
  { title: "Прогресс виден обоим", text: "Прогресс-бар и динамика показывают состояние клиента от встречи к встрече — удобно обсуждать изменения и удерживать в терапии.", illo: (
    <BFrame>{[["Тревога", 40, "var(--coral)"], ["Настроение", 72, "var(--green)"], ["Баланс", 61, "var(--purple)"]].map(([label, w, c]) => (
      <div key={label as string} className="flex items-center gap-2"><span className="w-16 text-[9px] font-bold text-[var(--muted)]">{label}</span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.7 }} style={{ background: c as string }} /></div></div>
    ))}</BFrame>
  ) },
  { title: "Выше в каталоге — больше клиентов", text: "На тарифе «Всё включено» ваш подтверждённый профиль поднимается в топ выдачи с бейджем «Рекомендуем». Клиенты находят вас первыми.", illo: (
    <BFrame>
      <div className="flex items-center gap-2 rounded-[10px] bg-[var(--amber)] px-2.5 py-2" style={{ border: "var(--bw) solid var(--amber-edge)" }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-[11px] font-black" style={{ border: "1px solid var(--amber-edge)" }}>1</span>
        <span className="flex-1 text-[10px] font-black">Ваш профиль</span>
        <span className="rounded-full bg-white px-1.5 py-0.5 text-[8px] font-black uppercase" style={{ border: "1px solid var(--amber-edge)" }}>рекомендуем</span>
      </div>
      {["Психолог · 4.9", "Психолог · 4.8"].map((t) => <div key={t} className="rounded-[10px] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>{t}</div>)}
    </BFrame>
  ) },
];

export const CLIENT_BENEFITS: HelpPage[] = [
  { title: "Отмечайте состояние каждый день", text: "Простой ежедневный чек-ин настроения. Видно, как проходят недели, — и легче замечать, что влияет на самочувствие.", illo: (
    <BFrame><div className="flex justify-center gap-1.5">{["😞", "😕", "😐", "🙂", "😄"].map((f, i) => <span key={i} className="flex h-9 w-9 items-center justify-center rounded-[11px] text-[18px]" style={{ background: i === 3 ? "var(--ink)" : `var(--mood-${i + 1})`, border: `var(--bw) solid ${i === 3 ? "var(--ink)" : "rgba(32,28,24,.4)"}` }}>{f}</span>)}</div><p className="text-center text-[10px] font-black text-[var(--muted)]">как вы сегодня?</p></BFrame>
  ) },
  { title: "Колесо баланса и научные шкалы", text: "Соберите колесо из 10 сфер жизни и пройдите WHO-5. Наглядная карта того, где сейчас ресурс, а где нужна опора.", illo: (
    <BFrame>{[["Здоровье", 70], ["Отношения", 85], ["Работа", 45], ["Отдых", 55]].map(([l, w]) => (
      <div key={l as string} className="flex items-center gap-2"><span className="w-16 text-[9px] font-bold text-[var(--muted)]">{l}</span>
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><div className="h-full rounded-full bg-[var(--purple)]" style={{ width: `${w}%` }} /></div></div>
    ))}</BFrame>
  ) },
  { title: "Дневники и практики под рукой", text: "Дневник эмоций и мыслей по КПТ, дыхательные практики и короткие медитации — всё, чтобы поддержать себя между встречами.", illo: (
    <BFrame>{[["Дневник эмоций", "heart"], ["Дыхание 4-7-8", "pulse"], ["Медитация 5 минут", "therapy"]].map(([t, ic]) => (
      <div key={t as string} className="flex items-center gap-2 rounded-[10px] bg-white px-2.5 py-1.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-[var(--purple)]" style={{ border: "1px solid var(--purple-edge)" }}><Icon name={ic as IconName} width={11} weight="bold" /></span>
        <span className="flex-1 text-[10px] font-black">{t}</span>
      </div>
    ))}</BFrame>
  ) },
  { title: "Прогресс виден вам и терапевту", text: "Динамика настроения и баланса помогает разговору на сессии — вы вместе видите, что меняется, и куда двигаться дальше.", illo: (
    <BFrame>{[["Настроение", 72, "var(--green)"], ["Баланс", 61, "var(--purple)"], ["Тревога", 38, "var(--coral)"]].map(([label, w, c]) => (
      <div key={label as string} className="flex items-center gap-2"><span className="w-16 text-[9px] font-bold text-[var(--muted)]">{label}</span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.7 }} style={{ background: c as string }} /></div></div>
    ))}</BFrame>
  ) },
];

export function SubscriptionBlock({ variant = "psy" }: { variant?: "psy" | "client" }) {
  const qc = useQueryClient();
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription, refetchInterval: (q) => (q.state.data?.status === "pending" ? 1500 : false) });
  const [benefits, setBenefits] = useState(false);
  const subscribe = useMutation({ mutationFn: (plan: PlanId) => startSubscription(plan), onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; else qc.invalidateQueries({ queryKey: ["subscription"] }); } });

  if (!sub) return <div className="skeleton h-40" />;
  const pending = sub.status === "pending";

  const hero = variant === "client" ? clientHero(sub) : psyHero(sub);
  const perks: { icon: IconName; label: string }[] = variant === "client"
    ? [{ icon: "mood", label: "Настроение" }, { icon: "balance", label: "Колесо баланса" }, { icon: "therapy", label: "Практики" }, { icon: "chart", label: "Прогресс" }]
    : [{ icon: "calendar", label: "Удобная работа" }, { icon: "spark", label: "Обновления методик" }, { icon: "heart", label: "Вовлечённость" }, { icon: "chart", label: "Прогресс клиента" }];

  const activeTools = variant === "psy" && sub.status === "active" && sub.tools;
  const clientActive = variant === "client" && sub.clientPro;
  const shownPlans: Plan[] = variant === "client" ? [CLIENT_PLAN] : activeTools && !sub.promo ? PSY_PLANS.filter((p) => p.id === "all") : PSY_PLANS;

  return (
    <section className="overflow-hidden rounded-[24px]" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
      <div className="relative p-5" style={{ background: "linear-gradient(150deg, var(--purple) 0%, var(--purple-soft) 100%)" }}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1 text-[11px] font-black text-white"><Icon name={variant === "client" ? "therapy" : "spark"} width={13} weight="fill" /> {variant === "client" ? "ВДОХ+" : "ВДОХ PRO"}</span>
          {hero.badge}
        </div>
        <div className="mt-3">
          <h3 className="font-tight text-[22px] font-black leading-tight">{hero.title}</h3>
          <p className="mt-1 text-[12px] font-bold text-[var(--muted)]">{hero.subtitle}</p>
          {hero.progress}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {perks.map((p) => (
            <div key={p.label} className="flex items-center gap-2 rounded-[12px] bg-[#fffdf7] px-2.5 py-2" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
              <Icon name={p.icon} width={15} weight="bold" /><span className="text-[11px] font-black leading-tight">{p.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { tap(); setBenefits(true); }} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white">
          <Icon name="spark" width={15} weight="fill" /> Смотреть возможности
        </button>
      </div>

      <div className="space-y-2.5 bg-[var(--surface)] p-4">
        {pending ? (
          <p className="py-2 text-center text-[13px] font-bold text-[var(--muted)]">Ждём подтверждение платежа…</p>
        ) : clientActive ? (
          <p className="py-2 text-center text-[13px] font-bold text-[var(--good)]">Вдох+ активен — все инструменты открыты.</p>
        ) : (
          <>
            {activeTools && !sub.promo && <p className="text-[12px] font-bold text-[var(--muted)]">Усильте профиль в каталоге:</p>}
            {shownPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onPick={() => subscribe.mutate(plan.id)} loading={subscribe.isPending} />)}
            <p className="pt-1 text-center text-[10px] font-semibold text-[var(--muted-2)]">Оплата через ЮKassa · отмена в любой момент{variant === "psy" ? " · годовая оплата — 2 месяца в подарок" : ""}</p>
          </>
        )}
      </div>

      {benefits && <HelpDeck title={variant === "client" ? "Возможности Вдох+" : "Возможности Вдох PRO"} pages={variant === "client" ? CLIENT_BENEFITS : PRO_BENEFITS} onClose={() => setBenefits(false)} doneLabel="Выбрать тариф" onDone={() => setBenefits(false)} />}
    </section>
  );
}

function psyHero(sub: Subscription): { badge: ReactNode; title: string; subtitle: string; progress: ReactNode } {
  if (sub.status === "trial") {
    const daysLeft = Math.min(10, trialDaysLeft(sub));
    return {
      badge: <span className="rounded-full bg-[#fffdf7] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>🎁 Триал</span>,
      title: "10 дней бесплатно",
      subtitle: `Полный доступ ко всем инструментам. Карта не нужна — осталось ${daysLeft} ${plural(daysLeft, "день", "дня", "дней")}.`,
      progress: <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#fffdf7]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full bg-[var(--ink)]" initial={{ width: 0 }} animate={{ width: `${(daysLeft / 10) * 100}%` }} transition={{ duration: 0.6 }} /></div>,
    };
  }
  if (sub.status === "pending") return { badge: null, title: "Подтверждаем оплату…", subtitle: "Обычно занимает пару секунд.", progress: null };
  if (sub.status === "active" && sub.tools) return { badge: <span className="rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }}>активна</span>, title: sub.promo ? "Всё включено активно" : "Практика активна", subtitle: `Продлится ${sub.currentPeriodEnd ? `до ${dF.format(new Date(sub.currentPeriodEnd))}` : "автоматически"}.`, progress: null };
  return { badge: null, title: "Триал закончился", subtitle: "Подключите тариф, чтобы продолжить работу.", progress: null };
}

function clientHero(sub: Subscription): { badge: ReactNode; title: string; subtitle: string; progress: ReactNode } {
  if (sub.clientPro) return { badge: <span className="rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }}>активен</span>, title: "Вдох+ подключён", subtitle: "Все инструменты для себя открыты. Спасибо, что заботитесь о себе!", progress: null };
  return {
    badge: <span className="rounded-full bg-[#fffdf7] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>390 ₽/мес</span>,
    title: "Инструменты для себя",
    subtitle: "Настроение, колесо баланса, дневники и практики между сессиями. Терапия работает лучше, когда вы в контакте с собой каждый день.",
    progress: null,
  };
}

function PlanCard({ plan, onPick, loading }: { plan: Plan; onPick: () => void; loading: boolean }) {
  const best = plan.best;
  return (
    <div className="relative rounded-[18px] p-3.5" style={{ background: best ? "var(--purple-soft)" : "#fff", border: `var(--bw-lg) solid ${best ? "var(--purple-edge)" : "var(--edge-neutral)"}` }}>
      {best && <span className="absolute -top-2.5 left-4 rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[9px] font-black uppercase text-white">{plan.id === "client" ? "рекомендуем" : "выгоднее"}</span>}
      <div className="flex items-baseline justify-between gap-2">
        <div><p className="text-[15px] font-black">{plan.name}</p><p className="text-[10px] font-black uppercase tracking-[.06em] text-[var(--muted-2)]">{plan.tag}</p></div>
        <div className="text-right"><p className="font-tight text-[22px] font-black leading-none">{rub(PLAN_PRICE[plan.id])}</p><p className="text-[10px] font-bold text-[var(--muted)]">в месяц</p></div>
      </div>
      <ul className="mt-2.5 space-y-1">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-1.5 text-[11px] font-semibold text-[var(--muted)]"><Icon name="check" width={13} weight="bold" className="mt-0.5 shrink-0" color="var(--green-edge)" />{perk}</li>
        ))}
      </ul>
      <button onClick={() => { tap(); onPick(); }} disabled={loading} className="mt-3 w-full rounded-[13px] py-2.5 text-[13px] font-black transition-transform active:scale-[0.98] disabled:opacity-50" style={best ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", border: "var(--bw) solid var(--purple-edge)" }}>
        {loading ? "Готовим оплату…" : `Подключить · ${rub(PLAN_PRICE[plan.id])}/мес`}
      </button>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
