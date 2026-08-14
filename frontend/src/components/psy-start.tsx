"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { SectionTitle } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { availabilityFromWorkHours } from "@/lib/availability";
import { listClients } from "@/lib/clients";
import { tap } from "@/lib/haptics";
import { getWorkHours } from "@/lib/schedule";

type Step = { title: string; text: string; href: string; cta: string; done: boolean };

// Первые шаги специалиста. Новый кабинет пуст: расписание не задано, клиентов
// нет, статистика в нулях — и человек уходит с главной, не поняв, что тут
// делать. Блок держит один следующий шаг и исчезает, когда практика запущена.
export function PsyStart({ hasSession }: { hasSession: boolean }) {
  const { data: work, isPending: workPending } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: clients, isPending: clientsPending } = useQuery({ queryKey: ["clients"], queryFn: listClients });

  // Пока данные едут, блок не рисуем: иначе он мигнёт у того, у кого всё давно сделано.
  if (workPending || clientsPending) return null;

  const steps: Step[] = [
    {
      title: "Откройте часы приёма",
      text: "Отметьте, когда вы принимаете. Дальше свободные окна платформа считает сама.",
      href: "/sessions",
      cta: "Задать часы",
      done: availabilityFromWorkHours(work).slots > 0,
    },
    {
      title: "Заведите первого клиента",
      text: "Создайте карточку сами или пришлите ссылку — человек подключится и появится в списке.",
      href: "/clients",
      cta: "Добавить клиента",
      done: (clients?.length ?? 0) > 0,
    },
    {
      title: "Запишите на первую сессию",
      text: "Напоминания и история встреч подхватятся сами, а после первой проведённой сессии включаются 14 дней PRO.",
      href: "/sessions",
      cta: "Записать на окно",
      done: hasSession,
    },
  ];

  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  const active = steps.findIndex((step) => !step.done);

  return (
    <section>
      <SectionTitle>С чего начать</SectionTitle>
      <div className="chunk overflow-hidden">
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="t-head">Ваш кабинет почти готов</span>
            <span className="t-micro tnum shrink-0">{done} из {steps.length}</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--head-soft)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(done / steps.length) * 100}%`, background: "var(--purple-edge)" }}
            />
          </div>
        </div>

        {steps.map((step, index) => (
          <div key={step.title} className={`flex gap-3 px-4 py-3.5 ${index || done ? "line-top" : ""}`}>
            <span
              className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[14px] font-black"
              style={step.done
                ? { background: "var(--green-soft)", color: "var(--green-edge)" }
                : { background: index === active ? "var(--purple-edge)" : "var(--head-soft)", color: index === active ? "#fff" : "var(--edge)" }}
            >
              {step.done ? <Icon name="check" width={18} weight="bold" color="var(--green-edge)" /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`t-head block ${step.done ? "opacity-55" : ""}`}>{step.title}</span>
              {!step.done && <span className="t-sub mt-0.5 block">{step.text}</span>}
              {index === active && (
                <Link
                  href={step.href}
                  onClick={tap}
                  className="btn mt-3 inline-flex px-4 py-2 text-[13px] transition-transform active:scale-[0.97]"
                >
                  {step.cta}
                </Link>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
