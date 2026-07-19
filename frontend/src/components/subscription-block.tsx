"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Icon, type IconName } from "@/components/icons";
import { getSubscription, PLAN_PRICE, rub, startSubscription, trialDaysLeft, type PlanId } from "@/lib/subscription";
import { tap } from "@/lib/haptics";

const dF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

type Plan = { id: PlanId; name: string; tag: string; perks: string[]; best?: boolean };
const PLANS: Plan[] = [
  { id: "tools", name: "Практика", tag: "инструменты", perks: ["Расписание, клиенты, сессии", "Домашние задания и техники", "Колесо баланса и трекеры", "Новые инструменты каждый месяц"] },
  { id: "promo", name: "Продвижение", tag: "каталог", perks: ["Подтверждённый профиль в каталоге", "Топ выдачи в вашем городе", "Бейдж «Рекомендуем»", "Статистика показов профиля"] },
  { id: "bundle", name: "Всё включено", tag: "выгода −490 ₽", best: true, perks: ["Весь инструментарий «Практики»", "Продвижение в каталоге", "Экономия 490 ₽ каждый месяц", "Приоритетная поддержка"] },
];

// Карусель преимуществ — мокапы экранов, чтобы показать пользу.
const BFrame = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[136px] flex-col justify-center gap-2 rounded-[16px] p-3" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>{children}</div>
);
const NewTag = () => <span className="rounded-full bg-[var(--coral)] px-1.5 py-0.5 text-[8px] font-black uppercase" style={{ border: "1px solid var(--coral-edge)" }}>ново</span>;

export const PRO_BENEFITS: HelpPage[] = [
  {
    title: "Вся практика в одном месте",
    text: "Расписание, клиенты, записи и домашние задания рядом. Меньше рутины — больше времени на работу с людьми.",
    illo: (
      <BFrame>
        {["10:00 · Марина · онлайн", "15:00 · свободное окно", "19:00 · Алёна · очно"].map((t, i) => (
          <div key={t} className="flex items-center gap-2 rounded-[10px] bg-white px-2.5 py-1.5 text-[10px] font-bold" style={{ border: `var(--bw) solid ${["var(--purple-edge)", "var(--edge-neutral)", "var(--green-edge)"][i]}` }}>{t}</div>
        ))}
      </BFrame>
    ),
  },
  {
    title: "Новые инструменты каждый месяц",
    text: "Мы добавляем методики по научным подходам — колесо баланса, WHO-5, дневники мыслей. Всё уже включено в подписку.",
    illo: (
      <BFrame>
        {[["Колесо баланса", true], ["Дневник мыслей КПТ", true], ["Шкала тревоги GAD-7", false]].map(([t, isNew]) => (
          <div key={t as string} className="flex items-center gap-2 rounded-[10px] bg-white px-2.5 py-1.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-[var(--purple)]" style={{ border: "1px solid var(--purple-edge)" }}><Icon name="spark" width={11} weight="bold" /></span>
            <span className="flex-1 text-[10px] font-black">{t}</span>{isNew && <NewTag />}
          </div>
        ))}
      </BFrame>
    ),
  },
  {
    title: "Клиент включён между сессиями",
    text: "Интерактивные трекеры повышают вовлечённость: клиент отмечает настроение и собирает колесо баланса — а вы видите это в его карточке.",
    illo: (
      <BFrame>
        <div className="flex justify-center gap-1.5">{["😞", "😕", "😐", "🙂", "😄"].map((f, i) => <span key={i} className="flex h-9 w-9 items-center justify-center rounded-[11px] text-[18px]" style={{ background: i === 3 ? "var(--ink)" : `var(--mood-${i + 1})`, border: `var(--bw) solid ${i === 3 ? "var(--ink)" : "rgba(32,28,24,.4)"}` }}>{f}</span>)}</div>
        <p className="text-center text-[10px] font-black text-[var(--muted)]">клиент отмечает состояние сам</p>
      </BFrame>
    ),
  },
  {
    title: "Прогресс виден обоим",
    text: "Прогресс-бар и динамика показывают состояние клиента от встречи к встрече — удобно обсуждать изменения и удерживать в терапии.",
    illo: (
      <BFrame>
        {[["Тревога", 40, "var(--coral)"], ["Настроение", 72, "var(--green)"], ["Баланс", 61, "var(--purple)"]].map(([label, w, c]) => (
          <div key={label as string} className="flex items-center gap-2">
            <span className="w-16 text-[9px] font-bold text-[var(--muted)]">{label}</span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.7 }} style={{ background: c as string }} /></div>
          </div>
        ))}
      </BFrame>
    ),
  },
  {
    title: "Выше в каталоге — больше клиентов",
    text: "На тарифе «Продвижение» ваш подтверждённый профиль поднимается в топ выдачи с бейджем «Рекомендуем». Клиенты находят вас первыми.",
    illo: (
      <BFrame>
        <div className="flex items-center gap-2 rounded-[10px] bg-[var(--amber)] px-2.5 py-2" style={{ border: "var(--bw) solid var(--amber-edge)" }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-[11px] font-black" style={{ border: "1px solid var(--amber-edge)" }}>1</span>
          <span className="flex-1 text-[10px] font-black">Ваш профиль</span>
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[8px] font-black uppercase" style={{ border: "1px solid var(--amber-edge)" }}>рекомендуем</span>
        </div>
        {["Психолог · 4.9", "Психолог · 4.8"].map((t) => <div key={t} className="rounded-[10px] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>{t}</div>)}
      </BFrame>
    ),
  },
];

const HERO_PERKS: { icon: IconName; label: string }[] = [
  { icon: "calendar", label: "Удобная работа" },
  { icon: "spark", label: "Обновления методик" },
  { icon: "heart", label: "Вовлечённость" },
  { icon: "chart", label: "Прогресс клиента" },
];

export function SubscriptionBlock() {
  const qc = useQueryClient();
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription, refetchInterval: (q) => (q.state.data?.status === "pending" ? 1500 : false) });
  const [benefits, setBenefits] = useState(false);
  const subscribe = useMutation({ mutationFn: (plan: PlanId) => startSubscription(plan), onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; else qc.invalidateQueries({ queryKey: ["subscription"] }); } });

  if (!sub) return <div className="skeleton h-40" />;
  const daysLeft = Math.min(10, trialDaysLeft(sub));
  const trial = sub.status === "trial";
  const pending = sub.status === "pending";
  const activeTools = sub.status === "active" && sub.tools;
  const activePromo = sub.status === "active" && sub.promo;
  const shownPlans = activeTools ? PLANS.filter((p) => p.id === "promo") : PLANS;

  return (
    <section className="overflow-hidden rounded-[24px]" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
      {/* Продающая шапка */}
      <div className="relative p-5" style={{ background: "linear-gradient(150deg, var(--purple) 0%, var(--purple-soft) 100%)" }}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1 text-[11px] font-black text-white"><Icon name="spark" width={13} weight="fill" /> ВДОХ PRO</span>
          {trial && <span className="rounded-full bg-[#fffdf7] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>🎁 Триал</span>}
          {activeTools && <span className="rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }}>активна</span>}
        </div>

        {trial ? (
          <div className="mt-3">
            <h3 className="font-tight text-[22px] font-black leading-tight">10 дней бесплатно</h3>
            <p className="mt-1 text-[12px] font-bold text-[var(--muted)]">Полный доступ ко всем инструментам. Карта не нужна — осталось <b className="text-[var(--ink)]">{daysLeft} {plural(daysLeft, "день", "дня", "дней")}</b>.</p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#fffdf7]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full bg-[var(--ink)]" initial={{ width: 0 }} animate={{ width: `${(daysLeft / 10) * 100}%` }} transition={{ duration: 0.6 }} /></div>
          </div>
        ) : pending ? (
          <div className="mt-3"><h3 className="font-tight text-[20px] font-black">Подтверждаем оплату…</h3><p className="mt-1 text-[12px] font-bold text-[var(--muted)]">Обычно занимает пару секунд.</p></div>
        ) : activeTools ? (
          <div className="mt-3"><h3 className="font-tight text-[20px] font-black leading-tight">{activePromo ? "Всё включено активно" : "Практика активна"}</h3><p className="mt-1 text-[12px] font-bold text-[var(--muted)]">Продлится {sub.currentPeriodEnd ? `до ${dF.format(new Date(sub.currentPeriodEnd))}` : "автоматически"}.</p></div>
        ) : (
          <div className="mt-3"><h3 className="font-tight text-[20px] font-black leading-tight">Триал закончился</h3><p className="mt-1 text-[12px] font-bold text-[var(--muted)]">Подключите тариф, чтобы продолжить работу.</p></div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {HERO_PERKS.map((p) => (
            <div key={p.label} className="flex items-center gap-2 rounded-[12px] bg-[#fffdf7] px-2.5 py-2" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
              <Icon name={p.icon} width={15} weight="bold" /><span className="text-[11px] font-black leading-tight">{p.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { tap(); setBenefits(true); }} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white">
          <Icon name="spark" width={15} weight="fill" /> Смотреть возможности
        </button>
      </div>

      {/* Тарифы */}
      <div className="space-y-2.5 bg-[var(--surface)] p-4">
        {pending ? (
          <p className="py-2 text-center text-[13px] font-bold text-[var(--muted)]">Ждём подтверждение платежа…</p>
        ) : (
          <>
            {activeTools && !activePromo && <p className="text-[12px] font-bold text-[var(--muted)]">Усильте профиль в каталоге:</p>}
            {shownPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onPick={() => subscribe.mutate(plan.id)} loading={subscribe.isPending} />)}
            <p className="pt-1 text-center text-[10px] font-semibold text-[var(--muted-2)]">Оплата через ЮKassa · отмена в любой момент · годовая оплата — 2 месяца в подарок</p>
          </>
        )}
      </div>

      {benefits && <HelpDeck title="Возможности Вдох PRO" pages={PRO_BENEFITS} onClose={() => setBenefits(false)} doneLabel="Выбрать тариф" onDone={() => setBenefits(false)} />}
    </section>
  );
}

function PlanCard({ plan, onPick, loading }: { plan: Plan; onPick: () => void; loading: boolean }) {
  const best = plan.best;
  return (
    <div className="relative rounded-[18px] p-3.5" style={{ background: best ? "var(--purple-soft)" : "#fff", border: `var(--bw-lg) solid ${best ? "var(--purple-edge)" : "var(--edge-neutral)"}` }}>
      {best && <span className="absolute -top-2.5 right-4 rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[9px] font-black uppercase text-white">выгоднее</span>}
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
