"use client";

import { PageHead } from "@/components/blocks";
import { Reveal } from "@/components/motion";
import { Icon } from "@/components/icons";

const PLANNED = [
  { icon: "book" as const, title: "Шаблоны техник", desc: "КПТ, ACT — готовые домашние задания" },
  { icon: "chart" as const, title: "Тесты и шкалы", desc: "PHQ-9, GAD-7 с автоподсчётом" },
  { icon: "heart" as const, title: "Дневник эмоций", desc: "Для клиентов — с доступом психологу" },
  { icon: "spark" as const, title: "Практики", desc: "Дыхание, заземление, аудио" },
];

export default function ToolsPage() {
  return (
    <div>
      <Reveal><PageHead title="Инструменты" sub="Раздел в разработке" /></Reveal>

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
