"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { GroupDetail } from "@/app/groups/[id]/group-detail";
import { PageHead } from "@/components/blocks";
import { GroupsDashboard } from "@/components/groups-dashboard";
import { Reveal } from "@/components/motion";
import { ModuleLocked, ModuleSoon, findModule } from "@/components/pro-modules";
import { getSubscription, isPro } from "@/lib/subscription";

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

  return (
    <div>
      <PageHead title={MOD.title} icon={MOD.icon} back="/tools" sub="Модуль для работы с несколькими пользователями" />
      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[27px] px-4 pb-8 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>
          {/* Модуль ещё не открыт — ни дашборда, ни витрины подписки: по прямой
              ссылке сюда попадают и в обход «Инструментов». */}
          {!MOD.live ? <ModuleSoon mod={MOD} /> : isPending ? null : pro ? <GroupsDashboard /> : <ModuleLocked mod={MOD} points={POINTS} />}
        </div>
      </Reveal>
    </div>
  );
}
