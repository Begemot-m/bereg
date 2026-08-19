"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { ClientAvatar } from "@/components/client-avatar";
import { useConfirmAsk } from "@/components/confirm-ask";
import { AttendanceForm, ClientPicker, EDGE, MemberStack, PlanForm, SOFT, SectionAction } from "@/components/groups-ui";
import { Sheet } from "@/components/groups-ui";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { Disclosure } from "@/components/ui";
import {
  KIND_LABEL,
  activeMembers,
  addMembers,
  cancelMeeting,
  cycle,
  deleteGroup,
  deleteMeeting,
  getGroup,
  isOver,
  markAttendance,
  marked,
  memberStats,
  nextMeeting,
  planMeetings,
  presentCount,
  removeMember,
  seatsLeft,
  updateGroup,
  whenLabel,
  type Group,
  type GroupMeeting,
} from "@/lib/groups";
import { tap } from "@/lib/haptics";

export function GroupDetail() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = Number(search.get("id") ?? params.id);
  const { ask, askNode } = useConfirmAsk();

  const [picking, setPicking] = useState(false);
  const [planning, setPlanning] = useState(false);
  // Встречу держим и после закрытия листа: иначе он уезжает вниз уже пустым.
  const [marking, setMarking] = useState<GroupMeeting | null>(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [settings, setSettings] = useState(false);

  const group = useQuery({ queryKey: ["group", id], queryFn: () => getGroup(id), enabled: Number.isFinite(id) });
  const g = group.data;

  const refresh = (next?: Group) => {
    if (next) qc.setQueryData(["group", id], next);
    void qc.invalidateQueries({ queryKey: ["group", id] });
    void qc.invalidateQueries({ queryKey: ["groups"] });
  };

  const add = useMutation({ mutationFn: (ids: number[]) => addMembers(id, ids), onSuccess: (r) => { refresh(r); setPicking(false); } });
  const remove = useMutation({ mutationFn: (memberId: number) => removeMember(id, memberId), onSuccess: refresh });
  const plan = useMutation({
    mutationFn: (input: { startsAt: string; durationMin: number; repeatWeeks: number }) => planMeetings(id, input),
    onSuccess: (r) => { refresh(r); setPlanning(false); },
  });
  const mark = useMutation({
    mutationFn: (rows: { memberId: number; present: boolean }[]) => markAttendance(id, marking!.id, rows),
    onSuccess: (r) => { refresh(r); setMarkOpen(false); },
  });
  const cancel = useMutation({ mutationFn: (mid: number) => cancelMeeting(id, mid), onSuccess: refresh });
  const dropMeeting = useMutation({ mutationFn: (mid: number) => deleteMeeting(id, mid), onSuccess: refresh });
  const rename = useMutation({ mutationFn: (patch: { title?: string; capacity?: number }) => updateGroup(id, patch), onSuccess: refresh });
  const drop = useMutation({ mutationFn: () => deleteGroup(id), onSuccess: () => { refresh(); router.push("/groups"); } });

  const members = g ? activeMembers(g) : [];
  const meetings = g ? cycle(g) : [];
  const next = g ? nextMeeting(g) : null;
  const past = meetings.filter((m) => isOver(m)).reverse();
  const future = meetings.filter((m) => !isOver(m));

  return (
    <div>
      <PageHead
        title={g?.title ?? "Группа"}
        icon="users"
        back="/groups"
        sub={g ? `${KIND_LABEL[g.kind]} · ${members.length} из ${g.capacity}` : undefined}
      />
      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[27px] px-4 pb-8 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>
          {!g ? null : (
            <>
              {/* Сводка: с чем ведущий сверяется первым делом. */}
              <div className="rounded-[19px] bg-white p-4" style={{ border: `var(--bw) solid ${EDGE}` }}>
                <div className="flex items-center gap-2.5">
                  <MemberStack group={g} size={32} />
                  <span className="min-w-0 flex-1 text-[11px] font-bold text-[var(--muted)]">
                    {members.length} из {g.capacity} мест
                    {seatsLeft(g) ? ` · свободно ${seatsLeft(g)}` : " · мест не осталось"}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--edge-neutral)" }}>
                  <Icon name="calendar" width={15} weight="bold" color={next ? EDGE : "var(--muted-2)"} />
                  {next ? (
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-black leading-tight">{whenLabel(next.startsAt)}</span>
                      <span className="block text-[10.5px] font-bold text-[var(--muted-2)]">
                        сессия {meetings.findIndex((m) => m.id === next.id) + 1} из {meetings.length} · {next.durationMin} мин
                      </span>
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 text-[12px] font-bold text-[var(--muted)]">Встречи не запланированы</span>
                  )}
                </div>
              </div>

              <div className="mb-2 mt-6 flex items-center justify-between gap-2">
                <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Встречи</p>
                <SectionAction icon="calendar" label="Запланировать" onClick={() => setPlanning(true)} />
              </div>
              {meetings.length ? (
                <div className="flex flex-col gap-1.5">
                  {future.map((m) => (
                    <MeetingRow
                      key={m.id}
                      group={g}
                      meeting={m}
                      onMark={() => { setMarking(m); setMarkOpen(true); }}
                      onCancel={() => ask({
                        title: "Отменить встречу?",
                        when: whenLabel(m.startsAt),
                        note: `Встреча пропадёт из расписания группы. Участников ${members.length} — предупредите их сами.`,
                        confirm: "Отменить встречу",
                        tone: "danger",
                        run: () => cancel.mutate(m.id),
                      })}
                    />
                  ))}
                  {past.map((m) => (
                    <MeetingRow
                      key={m.id}
                      group={g}
                      meeting={m}
                      onMark={() => { setMarking(m); setMarkOpen(true); }}
                      onCancel={() => ask({
                        title: "Удалить встречу?",
                        when: whenLabel(m.startsAt),
                        note: "Вместе с ней пропадут отметки посещаемости.",
                        confirm: "Удалить",
                        tone: "danger",
                        run: () => dropMeeting.mutate(m.id),
                      })}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-[13px] bg-white p-4 text-center text-[12px] font-semibold leading-snug text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
                  Расписания пока нет. Обычно группа ходит по одному дню недели — запланируйте весь цикл разом.
                </p>
              )}

              <div className="mb-2 mt-6 flex items-center justify-between gap-2">
                <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Состав</p>
                {seatsLeft(g) > 0 && <SectionAction icon="plus" label="Добавить" onClick={() => setPicking(true)} />}
              </div>
              {members.length ? (
                <div className="flex flex-col gap-1.5">
                  {members.map((m) => {
                    const s = memberStats(g, m.id);
                    // Три пропуска подряд — точка отсева, её и подсвечиваем.
                    const risky = s.of >= 3 && s.been <= s.of - 3;
                    return (
                      <button
                        key={m.id}
                        onClick={() => ask({
                          title: "Убрать из группы?",
                          note: `${m.name} перестанет числиться в составе. Отметки о прошлых встречах останутся.`,
                          confirm: "Убрать",
                          tone: "danger",
                          run: () => remove.mutate(m.id),
                        })}
                        className="flex items-center gap-2.5 rounded-[13px] bg-white p-2.5 text-left"
                        style={{ border: "var(--bw) solid var(--edge-neutral)" }}
                      >
                        <ClientAvatar name={m.name} photo={m.photo} className="keep-style h-9 w-9 rounded-full text-[12px] font-black" style={{ background: SOFT, color: EDGE }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-black leading-tight">{m.name}</span>
                          <span className="block text-[10.5px] font-bold" style={{ color: risky ? "var(--coral-edge)" : "var(--muted-2)" }}>
                            {s.of ? `был на ${s.been} из ${s.of}` : "встреч ещё не было"}
                            {risky ? " · пропадает" : ""}
                          </span>
                        </span>
                        <Icon name="close" width={13} weight="bold" color="var(--muted-2)" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-[13px] bg-white p-4 text-center text-[12px] font-semibold text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
                  Состав пуст — добавьте участников из своих клиентов.
                </p>
              )}

              {/* Редкие действия убраны под раскрытие: на виду они только мешают. */}
              <button
                onClick={() => { tap(); setSettings((v) => !v); }}
                aria-expanded={settings}
                className="mt-6 inline-flex min-h-9 items-center gap-1.5 text-[12px] font-black"
                style={{ color: "var(--muted)" }}
              >
                <Icon name="gear" width={14} weight="bold" color="var(--muted)" /> {settings ? "Свернуть" : "Настройки группы"}
              </button>
              <Disclosure open={settings}>
                <GroupSettings group={g} onSave={(patch) => rename.mutate(patch)} busy={rename.isPending} onDelete={() => ask({
                  title: "Удалить группу?",
                  note: `«${g.title}» исчезнет вместе с составом и расписанием. Карточки клиентов останутся на месте.`,
                  confirm: "Удалить",
                  tone: "danger",
                  run: () => drop.mutate(),
                })} />
              </Disclosure>
            </>
          )}
        </div>
      </Reveal>

      {g && (
        <>
          <Sheet open={picking} onClose={() => setPicking(false)} title="Кого добавить">
            <ClientPicker
              key={members.length}
              exclude={new Set(members.map((m) => m.clientId).filter((x): x is number => x !== null))}
              seats={seatsLeft(g)}
              onPick={(ids) => add.mutate(ids)}
              busy={add.isPending}
            />
          </Sheet>

          <Sheet open={planning} onClose={() => setPlanning(false)} title="Расписание группы">
            <PlanForm onPlan={(input) => plan.mutate(input)} busy={plan.isPending} />
          </Sheet>

          <Sheet open={markOpen} onClose={() => setMarkOpen(false)} title="Кто был на встрече">
            {marking && (
              <>
                <p className="mb-2 text-[11px] font-bold text-[var(--muted)]">{whenLabel(marking.startsAt)}</p>
                {/* key — чтобы отметки пересобрались под другую встречу. */}
                <AttendanceForm key={marking.id} group={g} meeting={marking} onSave={(rows) => mark.mutate(rows)} busy={mark.isPending} />
              </>
            )}
          </Sheet>
        </>
      )}

      {askNode}
    </div>
  );
}

function MeetingRow({ group, meeting, onMark, onCancel }: { group: Group; meeting: GroupMeeting; onMark: () => void; onCancel: () => void }) {
  const total = activeMembers(group).length;
  const over = isOver(meeting);
  const done = marked(meeting);
  const no = cycle(group).findIndex((m) => m.id === meeting.id) + 1;

  return (
    <div className="flex items-center gap-2.5 rounded-[13px] bg-white p-2.5" style={{ border: `var(--bw) solid ${over && !done ? "var(--amber-edge)" : "var(--edge-neutral)"}` }}>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-black leading-tight">{whenLabel(meeting.startsAt)}</span>
        <span className="block text-[10.5px] font-bold text-[var(--muted-2)]">
          сессия {no} из {cycle(group).length} · {meeting.durationMin} мин
          {done ? ` · пришли ${presentCount(meeting)} из ${total}` : ""}
        </span>
      </span>
      {over ? (
        <button
          onClick={() => { tap(); onMark(); }}
          className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black"
          style={done ? { background: SOFT, color: EDGE } : { background: "var(--amber-edge)", color: "#fff" }}
        >
          {done ? "Изменить" : "Отметить"}
        </button>
      ) : (
        <span className="chip keep-style shrink-0" style={{ background: SOFT, color: EDGE }}>впереди</span>
      )}
      <button onClick={() => { tap(); onCancel(); }} className="ico h-8 w-8 shrink-0 keep-style" style={{ background: "var(--surface-2)" }} aria-label="Убрать встречу">
        <Icon name="close" width={12} weight="bold" color="var(--muted)" />
      </button>
    </div>
  );
}

function GroupSettings({ group, onSave, onDelete, busy }: { group: Group; onSave: (patch: { title?: string; capacity?: number }) => void; onDelete: () => void; busy?: boolean }) {
  const [title, setTitle] = useState(group.title);
  const [capacity, setCapacity] = useState(group.capacity);
  const dirty = title.trim() !== group.title || capacity !== group.capacity;
  const min = Math.max(2, activeMembers(group).length);

  return (
    <div className="mt-2 rounded-[17px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      <label className="block">
        <span className="text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Название</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="tf mt-1 w-full" maxLength={120} />
      </label>

      {group.kind === "group" && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">Мест в группе</span>
            <span className="block text-[10.5px] font-bold text-[var(--muted-2)]">меньше, чем сейчас участников, не поставить</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <button onClick={() => { tap(); setCapacity((n) => Math.max(min, n - 1)); }} className="ico h-8 w-8 keep-style" style={{ background: SOFT }} aria-label="Меньше">
              <Icon name="close" width={13} weight="bold" color={EDGE} />
            </button>
            <span className="w-6 text-center text-[15px] font-black">{capacity}</span>
            <button onClick={() => { tap(); setCapacity((n) => Math.min(40, n + 1)); }} className="ico h-8 w-8 keep-style" style={{ background: SOFT }} aria-label="Больше">
              <Icon name="plus" width={13} weight="bold" color={EDGE} />
            </button>
          </span>
        </div>
      )}

      <button
        onClick={() => { tap(); onSave({ title: title.trim(), capacity }); }}
        disabled={!dirty || !title.trim() || busy}
        className="btn mt-3 w-full py-2.5"
      >
        Сохранить
      </button>
      <button onClick={() => { tap(); onDelete(); }} className="mt-1 w-full py-2.5 text-[12px] font-black" style={{ color: "var(--coral-edge)" }}>
        Удалить группу
      </button>
    </div>
  );
}
