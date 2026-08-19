"use client";

import { useQuery } from "@tanstack/react-query";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { ModuleLocked, findModule } from "@/components/pro-modules";
import { getSubscription, isPro } from "@/lib/subscription";

const MOD = findModule("groups");

// Что модуль умеет — один список на две роли экрана: он же продаёт подписку в
// замке, он же объясняет пустой раздел тому, у кого PRO уже есть.
const POINTS = [
  "Одна встреча на всю группу в календаре — вместо записи на каждого",
  "Приглашение по ссылке и из своих клиентов, места и заявки на входе",
  "Посещаемость по каждой встрече и ярлык у того, кто пропал",
  "Чек-ин до и после встречи — общий настрой группы в динамике",
  "Пара: общие заметки и раздельные приватные по каждому",
];

export default function GroupsPage() {
  const { data: sub, isPending } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const pro = isPro(sub);

  return (
    <div>
      <PageHead title={MOD.title} icon={MOD.icon} back="/tools" sub="Модуль PRO" />
      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[27px] px-4 pb-8 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>
          {isPending ? null : pro ? <GroupsEmpty /> : <ModuleLocked mod={MOD} points={POINTS} />}
        </div>
      </Reveal>
    </div>
  );
}

function GroupsEmpty() {
  return (
    <>
      <div className="rounded-[19px] bg-white p-5 text-center" style={{ border: `var(--bw) solid ${MOD.edge}` }}>
        <span className="ico mx-auto h-12 w-12 keep-style" style={{ background: MOD.soft }}>
          <Icon name="users" width={23} weight="bold" color={MOD.edge} />
        </span>
        <h2 className="mt-3 font-tight text-[18px] font-black leading-tight">Пока ни одной группы</h2>
        <p className="mx-auto mt-1 max-w-[290px] text-[12px] font-semibold leading-snug text-[var(--muted)]">
          Модуль подключён. Создание групп и пар включим следующим шагом — тогда эта страница наполнится.
        </p>
        <span className="chip keep-style mt-3 inline-block" style={{ background: "var(--head-soft)", color: "var(--muted)" }}>в разработке</span>
      </div>

      <p className="mb-2 mt-6 text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Что появится</p>
      <div className="flex flex-col gap-1.5">
        {POINTS.map((p) => (
          <span key={p} className="keep-style flex items-start gap-2 rounded-[13px] bg-white px-3 py-2.5 text-[12px] font-bold leading-snug" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
            <Icon name="check" width={13} weight="bold" color={MOD.edge} />
            <span className="min-w-0 flex-1">{p}</span>
          </span>
        ))}
      </div>
    </>
  );
}
