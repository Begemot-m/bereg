"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ArrowGlyph } from "@/components/blocks";
import { AttendanceDonut, CycleBar, DateBadge, DeltaTag, EDGE, GroupAvatar, MemberStack, Sheet, SOFT, Spark } from "@/components/groups-ui";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import {
  FORMAT_LABEL,
  KIND_LABEL,
  activeMembers,
  attendanceStats,
  createGroup,
  cycle,
  groupMoods,
  isOver,
  listGroups,
  marked,
  meetingNo,
  meetFormat,
  meetPlace,
  moodTrend,
  nextMeeting,
  seatsLeft,
  trendDelta,
  untilLabel,
  whenLabel,
  type Group,
  type GroupKind,
} from "@/lib/groups";
import { plural } from "@/lib/daily";
import { tap } from "@/lib/haptics";

export function GroupsDashboard() {
  const groups = useQuery({ queryKey: ["groups"], queryFn: listGroups });
  const [adding, setAdding] = useState(false);

  const list = groups.data ?? [];
  // Ближайшая по времени встреча среди всех групп — то, ради чего ведущий
  // открывает раздел. Отдельная строка — встреча, которую пора отметить.
  const upcoming = list
    .map((g) => ({ g, m: nextMeeting(g) }))
    .filter((x): x is { g: Group; m: NonNullable<ReturnType<typeof nextMeeting>> } => Boolean(x.m))
    .sort((a, b) => +new Date(a.m.startsAt) - +new Date(b.m.startsAt))[0];
  const unmarked = list
    .flatMap((g) => cycle(g).map((m) => ({ g, m })))
    .filter((x) => isOver(x.m) && !marked(x.m))
    .sort((a, b) => +new Date(b.m.startsAt) - +new Date(a.m.startsAt))[0];

  const stats = attendanceStats(list);

  // Дневники участников всех групп в одной линии: раньше динамика жила только
  // в карточке группы, и понять «как идут дела» разом было негде.
  const moods = useQueries({
    queries: list.map((g) => ({ queryKey: ["group-mood", g.id], queryFn: () => groupMoods(g.id), staleTime: 60_000 })),
  });
  const moodRows = moods.flatMap((q) => q.data ?? []).flatMap((r) => r.rows);
  const moodPoints = moodTrend(moodRows, 6);
  const moodLast = [...moodPoints].reverse().find((p) => p.avg !== null)?.avg ?? null;

  return (
    <>
      {unmarked && (
        <Reveal y={8}>
          <Link
            href={`/groups/?id=${unmarked.g.id}`}
            onClick={() => tap()}
            className="mb-2.5 flex items-center gap-3 rounded-[17px] p-3 transition-transform duration-200 active:scale-[.98]"
            style={{ background: "var(--amber-soft)", border: "var(--bw) solid var(--amber-edge)" }}
          >
            <span className="ico h-10 w-10 shrink-0 keep-style" style={{ background: "#fff" }}>
              <Icon name="check" width={19} weight="bold" color="var(--amber-edge)" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black leading-tight">Отметьте, кто был</span>
              <span className="block text-[11px] font-semibold text-[var(--muted)]">
                {unmarked.g.title} · {whenLabel(unmarked.m.startsAt)}
              </span>
            </span>
            <ArrowGlyph size={13} />
          </Link>
        </Reveal>
      )}

      {upcoming && (
        <Reveal y={8}>
          <Link
            href={`/groups/?id=${upcoming.g.id}`}
            onClick={() => tap()}
            className="block overflow-hidden rounded-[19px] bg-white transition-transform duration-200 active:scale-[.98]"
            style={{ border: `var(--bw) solid ${EDGE}` }}
          >
            <span className="flex items-center justify-between gap-2 px-4 pt-3">
              <span className="chip keep-style" style={{ background: SOFT, color: EDGE }}>Ближайшая встреча</span>
              <span className="keep-style rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: EDGE, color: "#fff" }}>
                {untilLabel(upcoming.m.startsAt)}
              </span>
            </span>

            <span className="mt-2.5 flex items-center gap-3 px-4">
              <DateBadge iso={upcoming.m.startsAt} size={62} />
              <span className="min-w-0 flex-1">
                <span className="tnum block font-tight text-[24px] font-black leading-none">
                  {new Date(upcoming.m.startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="mt-1 block truncate text-[13px] font-black leading-tight">{upcoming.g.title}</span>
                <span className="mt-0.5 block truncate text-[11px] font-bold text-[var(--muted)]">
                  {FORMAT_LABEL[meetFormat(upcoming.g, upcoming.m)].toLowerCase()} · {upcoming.m.durationMin} мин
                  {meetPlace(upcoming.g, upcoming.m) ? ` · ${meetPlace(upcoming.g, upcoming.m)}` : ""}
                </span>
              </span>
            </span>

            <span className="mt-3 block px-4">
              <CycleBar group={upcoming.g} thick />
            </span>

            <span className="mt-2.5 flex items-center gap-2 px-4 pb-3.5">
              <MemberStack group={upcoming.g} size={28} />
              <span className="min-w-0 flex-1 text-[11px] font-bold text-[var(--muted)]">
                {activeMembers(upcoming.g).length} {plural(activeMembers(upcoming.g).length, "участник", "участника", "участников")}
              </span>
              <span className="shrink-0 text-[11px] font-black" style={{ color: EDGE }}>
                сессия {meetingNo(upcoming.g, upcoming.m)} из {cycle(upcoming.g).length}
              </span>
            </span>
          </Link>
        </Reveal>
      )}

      {(stats.held > 0 || moodLast !== null) && (
        <Reveal y={8}>
          <div className="mt-2.5 rounded-[19px] bg-white p-4" style={{ border: `var(--bw) solid ${EDGE}` }}>
            {stats.held > 0 && (
              <div className="flex items-center gap-4">
                <AttendanceDonut rate={stats.rate} size={76} />
                <div className="min-w-0 flex-1">
                  <p className="font-tight text-[15px] font-black leading-tight">Посещаемость</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">
                    по {stats.held} отмеченным {plural(stats.held, "встрече", "встречам", "встречам")}
                  </p>
                  <div className="mt-2 flex flex-col gap-1">
                    <StatLine color={EDGE} label="пришли" value={stats.present} />
                    <StatLine color="var(--edge-neutral)" label="пропустили" value={stats.missed} />
                    {stats.ahead > 0 && <StatLine label="встреч впереди" value={stats.ahead} />}
                  </div>
                </div>
              </div>
            )}

            {moodLast !== null && (
              <div className={stats.held > 0 ? "mt-3.5 border-t pt-3.5" : ""} style={stats.held > 0 ? { borderColor: "var(--edge-neutral)" } : undefined}>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Состояние участников</p>
                    <p className="mt-0.5">
                      <span className="tnum font-tight text-[22px] font-black leading-none">{moodLast.toFixed(1)}</span>
                      <span className="text-[12px] font-black text-[var(--muted-2)]"> из 5</span>
                    </p>
                  </div>
                  <DeltaTag delta={trendDelta(moodPoints)} />
                </div>
                <Spark points={moodPoints.map((p) => p.avg)} width={252} height={44} thick />
                <p className="mt-1 text-[10.5px] font-bold text-[var(--muted-2)]">
                  Шесть недель · {moodRows.length} {plural(moodRows.length, "отметка", "отметки", "отметок")} из дневников
                </p>
              </div>
            )}
          </div>
        </Reveal>
      )}

      <div className="mb-2 mt-6 flex items-center justify-between gap-2">
        <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Мои группы</p>
        {list.length > 0 && (
          <button onClick={() => { tap(); setAdding(true); }} className="inline-flex min-h-9 items-center gap-1.5 text-[12px] font-black" style={{ color: EDGE }}>
            <Icon name="plus" width={14} weight="bold" color={EDGE} /> Создать
          </button>
        )}
      </div>

      {groups.isPending ? null : list.length ? (
        <div className="flex flex-col gap-2.5">
          {list.map((g, i) => (
            <Reveal key={g.id} delay={0.03 + i * 0.04}>
              <GroupRow group={g} />
            </Reveal>
          ))}
        </div>
      ) : (
        <EmptyGroups onAdd={() => setAdding(true)} />
      )}

      <NewGroupSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function StatLine({ color, label, value }: { color?: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] font-bold">
      {color ? <span className="keep-style h-2 w-2 shrink-0 rounded-full" style={{ background: color }} /> : <span className="w-2 shrink-0" />}
      <span className="tnum font-black">{value}</span>
      <span className="text-[var(--muted)]">{label}</span>
    </span>
  );
}

function GroupRow({ group }: { group: Group }) {
  const next = nextMeeting(group);
  const left = seatsLeft(group);
  const stats = attendanceStats([group]);
  return (
    <Link
      href={`/groups/?id=${group.id}`}
      onClick={() => tap()}
      className="block rounded-[17px] bg-white p-3 transition-transform duration-200 active:scale-[.98]"
      style={{ border: `var(--bw) solid ${EDGE}` }}
    >
      <span className="flex items-center gap-3">
        {next ? (
          <DateBadge iso={next.startsAt} size={50} />
        ) : (
          <span className="ico h-[50px] w-[50px] shrink-0 keep-style rounded-[15px]" style={{ background: "var(--surface-2)" }}>
            <Icon name="clock" width={18} weight="bold" color="var(--muted-2)" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <GroupAvatar avatar={group.avatar} size={20} radius={7} />
            <span className="font-tight text-[15px] font-black leading-tight">{group.title}</span>
            <span className="chip keep-style" style={{ background: SOFT, color: EDGE }}>{KIND_LABEL[group.kind]}</span>
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: next ? "var(--ink)" : "var(--muted-2)" }}>
            {next ? (
              <>
                <span className="tnum">{whenLabel(next.startsAt)}</span>
                <span className="font-semibold text-[var(--muted)]">· {FORMAT_LABEL[meetFormat(group, next)].toLowerCase()}</span>
              </>
            ) : (
              "встречи не запланированы"
            )}
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <MemberStack group={group} size={24} />
            <span className="text-[10.5px] font-bold text-[var(--muted)]">
              {activeMembers(group).length} из {group.capacity}
              {group.kind === "group" && left > 0 ? ` · свободно ${left}` : ""}
            </span>
          </span>
        </span>
        {stats.held > 0 && <AttendanceDonut rate={stats.rate} size={38} />}
        <ArrowGlyph size={13} />
      </span>
      <span className="mt-2.5 block">
        <CycleBar group={group} />
      </span>
    </Link>
  );
}

function EmptyGroups({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-[19px] bg-white p-5 text-center" style={{ border: `var(--bw) solid ${EDGE}` }}>
      <span className="ico mx-auto h-12 w-12 keep-style" style={{ background: SOFT }}>
        <Icon name="users" width={23} weight="bold" color={EDGE} />
      </span>
      <h2 className="mt-3 font-tight text-[18px] font-black leading-tight">Пока ни одной группы</h2>
      <p className="mx-auto mt-1 max-w-[280px] text-[12px] font-semibold leading-snug text-[var(--muted)]">
        Заведите группу или пару — состав соберётся из ваших клиентов, а встречи станут одной записью на всех.
      </p>
      <button onClick={() => { tap(); onAdd(); }} className="btn mt-4 w-full py-3">Создать группу</button>
    </div>
  );
}

function NewGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<GroupKind>("group");
  const [capacity, setCapacity] = useState(8);

  const create = useMutation({
    mutationFn: () => createGroup({ title: title.trim(), kind, capacity }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["groups"] });
      setTitle("");
      setKind("group");
      setCapacity(8);
      onClose();
    },
  });

  return (
    <Sheet open={open} onClose={onClose} title="Новая группа">
      <div className="grid grid-cols-2 gap-2">
        {(["group", "pair"] as GroupKind[]).map((k) => (
          <button
            key={k}
            onClick={() => { tap(); setKind(k); setCapacity(k === "pair" ? 2 : 8); }}
            className="rounded-[13px] py-2.5 text-[13px] font-black"
            style={kind === k ? { background: EDGE, color: "#fff" } : { background: "#fff", border: "var(--bw) solid var(--edge-neutral)" }}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Название</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "pair" ? "Марина и Дмитрий" : "Группа поддержки"}
          className="tf mt-1 w-full"
          maxLength={120}
        />
      </label>

      {/* У пары мест всегда два — спрашивать не о чем. */}
      {kind === "group" && (
        <div className="mt-3 flex items-center justify-between rounded-[13px] bg-white px-3 py-2.5" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
          <span className="text-[13px] font-bold">Мест в группе</span>
          <span className="flex items-center gap-3">
            <button onClick={() => { tap(); setCapacity((n) => Math.max(2, n - 1)); }} className="ico h-8 w-8 keep-style" style={{ background: SOFT }} aria-label="Меньше">
              <Icon name="close" width={13} weight="bold" color={EDGE} />
            </button>
            <span className="w-6 text-center text-[15px] font-black">{capacity}</span>
            <button onClick={() => { tap(); setCapacity((n) => Math.min(40, n + 1)); }} className="ico h-8 w-8 keep-style" style={{ background: SOFT }} aria-label="Больше">
              <Icon name="plus" width={13} weight="bold" color={EDGE} />
            </button>
          </span>
        </div>
      )}

      <button onClick={() => { tap(); create.mutate(); }} disabled={!title.trim() || create.isPending} className="btn mt-4 w-full py-3">
        Создать
      </button>
    </Sheet>
  );
}
