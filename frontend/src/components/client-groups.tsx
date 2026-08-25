"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icons";
import { AttendanceDonut, CycleBar, DateBadge, EDGE, MemberStack, PresenceDots, SOFT } from "@/components/groups-ui";
import { plural } from "@/lib/daily";
import { tap } from "@/lib/haptics";
import {
  FORMAT_LABEL,
  KIND_LABEL,
  activeMembers,
  cycle,
  groupsOfClient,
  listGroups,
  meetFormat,
  meetPlace,
  meetingNo,
  memberOfClient,
  memberStats,
  nextMeeting,
  untilLabel,
  type Group,
  type GroupMember,
} from "@/lib/groups";
import { GROUPS_LIVE } from "@/lib/modules";
import { getSubscription, isPro } from "@/lib/subscription";

/**
 * Группы клиента в его карточке. Человек, пришедший по ссылке набора, до сих
 * пор выглядел как обычный клиент: карточка заводилась, а о том, что он ходит
 * в группу, в ней не было ни слова — ведущий видел это только со стороны
 * группы. Блок отвечает на три вопроса подряд: где он состоит, когда
 * ближайшая встреча и как он ходит.
 *
 * Появляется только у тех, кого специалист сам поставил в состав: у остальных
 * карточек блока нет вовсе, пустой заглушки тоже.
 */
export function ClientGroups({ clientId }: { clientId: number }) {
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription, enabled: GROUPS_LIVE });
  const pro = isPro(sub);
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: listGroups,
    enabled: GROUPS_LIVE && pro,
    retry: false,
  });

  const mine = groupsOfClient(groups, clientId);
  if (!mine.length) return null;

  return (
    <section className="card-soft p-3">
      <div className="flex items-center gap-2.5 px-1 pb-2.5">
        <span className="ico h-8 w-8 shrink-0 keep-style" style={{ background: "#fff" }}>
          <Icon name="users" width={15} weight="bold" color={EDGE} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-head">Групповая работа</p>
          <p className="t-cap mt-0.5">
            {mine.length === 1
              ? "состоит в одной группе"
              : `состоит в ${mine.length} ${plural(mine.length, "группе", "группах", "группах")}`}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {mine.map((group, i) => (
          <GroupRow key={group.id} group={group} clientId={clientId} delay={i * 0.05} />
        ))}
      </div>
    </section>
  );
}

function GroupRow({ group, clientId, delay }: { group: Group; clientId: number; delay: number }) {
  const router = useRouter();
  const member = memberOfClient(group, clientId) as GroupMember | null;
  if (!member) return null;

  const stats = memberStats(group, member.id);
  const fading = stats.missed >= 3;
  const next = nextMeeting(group);
  const rate = stats.of ? Math.round((stats.been / stats.of) * 100) : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 320, damping: 30 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => { tap(); router.push(`/groups/?id=${group.id}`); }}
      className="card-plain w-full overflow-hidden p-3 text-left"
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-tight text-[14.5px] font-black leading-tight">{group.title}</p>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="chip keep-style" style={{ background: SOFT, color: EDGE }}>{KIND_LABEL[group.kind]}</span>
            <span className="text-[10.5px] font-bold text-[var(--muted-2)]">
              {activeMembers(group).length} {plural(activeMembers(group).length, "участник", "участника", "участников")}
            </span>
          </span>
        </div>
        <MemberStack group={group} size={26} />
      </div>

      <div className="mt-2.5">
        <CycleBar group={group} />
      </div>

      {next ? (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-[15px] p-2.5" style={{ background: SOFT }}>
          <DateBadge iso={next.startsAt} size={46} tone="edge" />
          <div className="min-w-0 flex-1">
            <p className="tnum text-[13px] font-black leading-tight">
              {new Date(next.startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              <span className="font-bold"> · {FORMAT_LABEL[meetFormat(group, next)].toLowerCase()}</span>
            </p>
            <p className="mt-0.5 truncate text-[10.5px] font-bold text-[var(--muted)]">
              {meetPlace(group, next) || `сессия ${meetingNo(group, next)} из ${cycle(group).length}`}
            </p>
          </div>
          <span className="keep-style shrink-0 rounded-full px-2 py-1 text-[10px] font-black" style={{ background: "#fff", color: EDGE }}>
            {untilLabel(next.startsAt)}
          </span>
        </div>
      ) : (
        <p className="mt-2.5 rounded-[13px] px-2.5 py-2 text-[11.5px] font-bold text-[var(--muted)]" style={{ background: "var(--surface-2)" }}>
          Следующая встреча ещё не назначена
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <PresenceDots group={group} memberId={member.id} delay={delay + 0.12} />
          <p className="mt-1 text-[10.5px] font-bold" style={{ color: fading ? "var(--coral-edge)" : "var(--muted)" }}>
            {stats.of
              ? `был на ${stats.been} из ${stats.of} ${plural(stats.of, "встречи", "встреч", "встреч")}`
              : "отмеченных встреч ещё не было"}
          </p>
        </div>
        {rate !== null && <AttendanceDonut rate={rate} size={38} />}
      </div>

      {fading && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-[11px] px-2.5 py-2 text-[11px] font-black leading-snug" style={{ background: "var(--coral-soft)", color: "var(--ink)" }}>
          <Icon name="warn" width={12} weight="bold" color="var(--coral-edge)" className="mt-px shrink-0" />
          Пропустил {stats.missed} {plural(stats.missed, "встречу", "встречи", "встреч")} подряд — стоит написать до следующей
        </p>
      )}
    </motion.button>
  );
}
