"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { GroupDetail } from "@/app/groups/[id]/group-detail";
import { PageHead } from "@/components/blocks";
import { GroupsDashboard } from "@/components/groups-dashboard";
import { Reveal } from "@/components/motion";
import { ModuleLocked, ModuleSoon, findModule } from "@/components/pro-modules";
import { WebTitle } from "@/components/web-ui";
import { getSubscription, isPro } from "@/lib/subscription";
import { useWebMode } from "@/lib/web-mode";

const MOD = findModule("groups");

const POINTS = [
  "Одна встреча на всю группу в календаре — вместо записи на каждого",
  "Состав собирается из ваших клиентов, места считаются сами",
  "Посещаемость по каждой встрече и ярлык у того, кто пропал",
  "Пара: общие заметки и раздельные приватные по каждому",
];

// Карточка группы живёт на этом же роуте: в статическом экспорте страница
// `/groups/[id]` есть только для демо-группы, а созданные в рантайме открываются
// как `/groups/?id=N` — тем же приёмом, что карточки клиентов.
export default function GroupsPage() {
  const search = useSearchParams();
  return search.get("id") ? <GroupDetail /> : <GroupsHome />;
}

function GroupsHome() {
  const { data: sub, isPending } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const pro = isPro(sub);
  const web = useWebMode();

  const body = !MOD.live ? <ModuleSoon mod={MOD} /> : isPending ? null : pro ? <GroupsDashboard web={web} /> : <ModuleLocked mod={MOD} points={POINTS} />;

  if (web) {
    return (
      <div data-wide className="pb-4">
        <Link href="/tools" className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: "var(--muted)" }}>← Инструменты</Link>
        <div className="mt-3"><WebTitle title={MOD.title} sub="Модуль для работы с несколькими пользователями" /></div>
        {body}
      </div>
    );
  }

  return (
    <div>
      <PageHead title={MOD.title} icon={MOD.icon} back="/tools" sub="Модуль для работы с несколькими пользователями" />
      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[27px] px-4 pb-8 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>
          {/* Модуль ещё не открыт — ни дашборда, ни витрины подписки: по прямой
              ссылке сюда попадают и в обход «Инструментов». */}
          {body}
        </div>
      </Reveal>
    </div>
  );
}
