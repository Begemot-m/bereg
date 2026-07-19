"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PageHead } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { SubscriptionBlock } from "@/components/subscription-block";
import { getSubscription } from "@/lib/subscription";
import { useRole } from "@/lib/role";

// Бесплатные инструменты психолога — быстрый переход в раздел.
const PSY_FREE: { icon: IconName; title: string; desc: string; href: string }[] = [
  { icon: "users", title: "Клиенты и карточки", desc: "База, заметки, прогресс", href: "/clients" },
  { icon: "calendar", title: "Сессии и записи", desc: "Ближайшие, неделя, календарь", href: "/sessions" },
  { icon: "clock", title: "Расписание и окна", desc: "Часы работы, форматы приёма", href: "/cabinet" },
  { icon: "balance", title: "Колесо баланса клиента", desc: "Смотреть в карточке клиента", href: "/clients" },
];

// По подписке PRO — затемнены (данные о подписке не показываем, только метку).
const PSY_PRO: { icon: IconName; title: string; desc: string }[] = [
  { icon: "book", title: "Шаблоны техник", desc: "Готовые домашки: КПТ, ACT" },
  { icon: "chart", title: "Тесты и шкалы", desc: "PHQ-9, GAD-7 с автоподсчётом" },
  { icon: "spark", title: "Аналитика практики", desc: "Динамика, удержание, доход" },
  { icon: "note", title: "Экспорт заметок", desc: "PDF-отчёты по клиенту" },
];

// Инструменты клиента («приколюхи»): часть бесплатна, часть — по подписке «Вдох+».
const CLIENT_TOOLS: { icon: IconName; title: string; desc: string; pro: boolean }[] = [
  { icon: "mood", title: "Дневник настроения", desc: "Ежедневный чек-ин состояния", pro: false },
  { icon: "balance", title: "Колесо баланса", desc: "10 сфер жизни, наглядная карта", pro: false },
  { icon: "note", title: "Дневник эмоций и мыслей", desc: "Разбор ситуаций по КПТ", pro: true },
  { icon: "pulse", title: "Дыхание 4-7-8", desc: "Успокоиться за пару минут", pro: true },
  { icon: "therapy", title: "Медитации", desc: "Короткие аудио-практики", pro: true },
  { icon: "check", title: "Трекер привычек", desc: "Маленькие шаги каждый день", pro: true },
  { icon: "chart", title: "Шкала тревоги GAD-7", desc: "Отслеживать динамику тревоги", pro: true },
];

export default function ToolsPage() {
  const [role] = useRole();
  if (role === "psychologist") return <PsyTools />;
  return <ClientTools />;
}

function ClientTools() {
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const unlocked = !!sub?.clientPro;
  return (
    <div>
      <PageHead title="Инструменты" sub="Забота о себе между сессиями" />

      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[30px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
          <SubscriptionBlock variant="client" />

          <p className="mb-2 mt-6 text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Что внутри</p>
          <div className="space-y-2">
            {CLIENT_TOOLS.map((t, i) => {
              const locked = t.pro && !unlocked;
              return (
                <Reveal key={t.title} delay={0.04 + i * 0.04}>
                  <div className="flex items-center gap-3 rounded-[16px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)", opacity: locked ? 0.78 : 1 }}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ background: t.pro ? "var(--purple-soft)" : "var(--green-soft)", border: `var(--bw) solid ${t.pro ? "var(--purple-edge)" : "var(--green-edge)"}` }}><Icon name={t.icon} width={18} weight="bold" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[14px] font-black">{t.title}</span><span className="block text-[12px] font-semibold text-[var(--muted)]">{t.desc}</span></span>
                    {t.pro
                      ? <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: locked ? "var(--purple-soft)" : "var(--green-soft)", border: `var(--bw) solid ${locked ? "var(--purple-edge)" : "var(--green-edge)"}` }}>{locked ? "Вдох+" : "открыто"}</span>
                      : <span className="shrink-0 rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[10px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }}>бесплатно</span>}
                  </div>
                </Reveal>
              );
            })}
          </div>

          <p className="mt-4 text-center text-[11px] font-semibold text-[var(--muted-2)]">Всё это открывается и в вашей <Link href="/therapy" className="font-black text-[var(--purple-edge)]">терапии</Link> — прогресс виден терапевту.</p>
        </div>
      </Reveal>
    </div>
  );
}

function PsyTools() {
  return (
    <div>
      <PageHead title="Инструменты" sub="Всё для практики" />

      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[30px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)", borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
          <p className="mb-2 text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Быстрый доступ</p>
          <div className="space-y-2">
            {PSY_FREE.map((t, i) => (
              <Reveal key={t.title} delay={0.03 + i * 0.04}>
                <Link href={t.href} className="flex items-center gap-3 rounded-[16px] bg-white p-3 transition-transform active:scale-[0.99]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }}><Icon name={t.icon} width={18} weight="bold" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[14px] font-black">{t.title}</span><span className="block text-[12px] font-semibold text-[var(--muted)]">{t.desc}</span></span>
                  <span className="text-[18px] font-black text-[var(--muted-2)]">›</span>
                </Link>
              </Reveal>
            ))}
          </div>

          <p className="mb-2 mt-6 text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">По подписке PRO</p>
          <div className="space-y-2">
            {PSY_PRO.map((t, i) => (
              <Reveal key={t.title} delay={0.03 + i * 0.04}>
                <div className="flex items-center gap-3 rounded-[16px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)", opacity: 0.6 }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ background: "var(--surface-2)", border: "var(--bw) solid var(--edge-neutral)" }}><Icon name={t.icon} width={18} weight="bold" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[14px] font-black">{t.title}</span><span className="block text-[12px] font-semibold text-[var(--muted)]">{t.desc}</span></span>
                  <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.04em] text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>PRO</span>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] font-semibold text-[var(--muted-2)]">Открывается на тарифе PRO — подключить можно в <Link href="/cabinet" className="font-black text-[var(--edge)]">кабинете</Link>.</p>
        </div>
      </Reveal>
    </div>
  );
}
