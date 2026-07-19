"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PageHead } from "@/components/blocks";
import { Icon, type IconName } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { SubscriptionBlock } from "@/components/subscription-block";
import { getSubscription } from "@/lib/subscription";
import { useRole } from "@/lib/role";

const PLANNED = [
  { icon: "book" as const, title: "Шаблоны техник", desc: "КПТ, ACT — готовые домашние задания" },
  { icon: "chart" as const, title: "Тесты и шкалы", desc: "PHQ-9, GAD-7 с автоподсчётом" },
  { icon: "heart" as const, title: "Дневник эмоций", desc: "Для клиентов — с доступом психологу" },
  { icon: "spark" as const, title: "Практики", desc: "Дыхание, заземление, аудио" },
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
      <PageHead title="Инструменты" sub="Раздел в разработке" />

      <Reveal delay={0.05}>
        <div className="rounded-2xl p-5 text-center" style={{ background: "var(--a-tint, #eef0fb)" }}>
          <span className="sheen-fill mx-auto block h-1.5 w-10 rounded-full" />
          <p className="mt-3 font-semibold">Собираем самое полезное</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] text-[var(--muted)]">
            Ниже — что появится первым. Хотите повлиять на порядок? Напишите в отдел заботы в кабинете.
          </p>
        </div>
      </Reveal>

      <div className="mt-5 space-y-2.5">
        {PLANNED.map((p, i) => (
          <Reveal key={p.title} delay={0.1 + i * 0.06}>
            <div className="flex items-center gap-3.5 rounded-2xl bg-white p-4 opacity-80" style={{ border: "1px dashed rgba(44,46,49,0.18)" }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)]">
                <Icon name={p.icon} width={18} height={18} />
              </span>
              <span className="flex-1">
                <p className="text-[14px] font-semibold">{p.title}</p>
                <p className="text-[12px] text-[var(--muted)]">{p.desc}</p>
              </span>
              <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted-2)]">
                скоро
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
