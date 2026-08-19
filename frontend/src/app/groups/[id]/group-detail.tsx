"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { ClientAvatar } from "@/components/client-avatar";
import { useConfirmAsk } from "@/components/confirm-ask";
import {
  AttendanceDonut,
  AttendanceForm,
  ClientPicker,
  EDGE,
  MemberStack,
  PlanForm,
  SOFT,
  SectionAction,
  Sheet,
  Tabs,
  Toggle,
} from "@/components/groups-ui";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { Disclosure } from "@/components/ui";
import {
  FORMAT_LABEL,
  KIND_LABEL,
  activeMembers,
  addMembers,
  addTask,
  attendanceStats,
  cancelMeeting,
  cycle,
  deleteGroup,
  deleteMeeting,
  getGroup,
  isOver,
  markAttendance,
  marked,
  meetFormat,
  meetPlace,
  memberStats,
  nextMeeting,
  planMeetings,
  presentCount,
  removeMember,
  removeTask,
  seatsLeft,
  toggleTask,
  updateGroup,
  whenLabel,
  type Group,
  type GroupMeeting,
  type GroupPatch,
  type MeetFormat,
} from "@/lib/groups";
import { tap } from "@/lib/haptics";

type Tab = "meetings" | "members" | "tasks";

export function GroupDetail() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = Number(search.get("id") ?? params.id);
  const { ask, askNode } = useConfirmAsk();

  const [tab, setTab] = useState<Tab>("meetings");
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
  const save = useMutation({ mutationFn: (patch: GroupPatch) => updateGroup(id, patch), onSuccess: refresh });
  const drop = useMutation({ mutationFn: () => deleteGroup(id), onSuccess: () => { refresh(); router.push("/groups"); } });
  const newTask = useMutation({ mutationFn: (text: string) => addTask(id, { text }), onSuccess: refresh });
  const flipTask = useMutation({
    mutationFn: (t: { taskId: number; status: "open" | "done" }) => toggleTask(id, t.taskId, t.status),
    onSuccess: refresh,
  });
  const dropTask = useMutation({ mutationFn: (taskId: number) => removeTask(id, taskId), onSuccess: refresh });

  const members = g ? activeMembers(g) : [];
  const meetings = g ? cycle(g) : [];
  const next = g ? nextMeeting(g) : null;
  const past = meetings.filter((m) => isOver(m)).reverse();
  const future = meetings.filter((m) => !isOver(m));
  const openTasks = g ? g.tasks.filter((t) => t.status === "open") : [];
  const stats = g ? attendanceStats([g]) : null;

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
              {/* Сводка: всё, что нужно знать перед встречей, без прокрутки. */}
              <div className="rounded-[19px] bg-white p-4" style={{ border: `var(--bw) solid ${EDGE}` }}>
                <div className="flex items-center gap-3">
                  {stats && stats.held > 0 ? <AttendanceDonut rate={stats.rate} size={62} /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <MemberStack group={g} size={28} />
                      <span className="text-[11px] font-bold text-[var(--muted)]">
                        {members.length} из {g.capacity}
                        {seatsLeft(g) ? ` · свободно ${seatsLeft(g)}` : ""}
                      </span>
                    </div>
                    {stats && stats.held > 0 && (
                      <p className="mt-1.5 text-[11px] font-bold text-[var(--muted)]">
                        посещаемость по {stats.held} встречам
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 border-t pt-3" style={{ borderColor: "var(--edge-neutral)" }}>
                  <Icon name="calendar" width={15} weight="bold" color={next ? EDGE : "var(--muted-2)"} />
                  {next ? (
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-black leading-tight">{whenLabel(next.startsAt)}</span>
                      <span className="block text-[10.5px] font-bold text-[var(--muted-2)]">
                        сессия {meetings.findIndex((m) => m.id === next.id) + 1} из {meetings.length} · {next.durationMin} мин ·{" "}
                        {FORMAT_LABEL[meetFormat(g, next)].toLowerCase()}
                      </span>
                      {meetPlace(g, next) && (
                        <span className="mt-0.5 block text-[10.5px] font-bold" style={{ color: EDGE }}>{meetPlace(g, next)}</span>
                      )}
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 text-[12px] font-bold text-[var(--muted)]">Встречи не запланированы</span>
                  )}
                </div>

                {g.resourceUrl && (
                  <a
                    href={g.resourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => tap()}
                    className="mt-2 flex items-center gap-2 border-t pt-2.5 text-[12px] font-black"
                    style={{ borderColor: "var(--edge-neutral)", color: EDGE }}
                  >
                    <Icon name="share" width={14} weight="bold" color={EDGE} />
                    <span className="min-w-0 flex-1 truncate">{g.resourceUrl.replace(/^https?:\/\//, "")}</span>
                  </a>
                )}
              </div>

              {g.about && (
                <div className="mt-2.5 rounded-[17px] p-3.5" style={{ background: SOFT }}>
                  <p className="text-[11px] font-black uppercase tracking-[.06em]" style={{ color: EDGE }}>Для участников</p>
                  <p className="mt-1 whitespace-pre-line text-[12.5px] font-semibold leading-snug">{g.about}</p>
                </div>
              )}

              <div className="mt-4">
                <Tabs
                  value={tab}
                  onChange={setTab}
                  items={[
                    { id: "meetings", label: "Встречи", badge: future.length },
                    { id: "members", label: "Состав", badge: members.length },
                    { id: "tasks", label: "Задания", badge: openTasks.length },
                  ]}
                />
              </div>

              {tab === "meetings" && (
                <>
                  <div className="mb-2 mt-4 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Расписание</p>
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
                            note: `Встреча пропадёт из расписания и из календаря. Участников ${members.length}.`,
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
                    <Empty text="Расписания пока нет. Обычно группа ходит по одному дню недели — запланируйте весь цикл разом." />
                  )}
                </>
              )}

              {tab === "members" && (
                <>
                  <div className="mb-2 mt-4 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Участники</p>
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
                    <Empty text="Состав пуст — добавьте участников из своих клиентов." />
                  )}
                </>
              )}

              {tab === "tasks" && (
                <>
                  <p className="mb-2 mt-4 text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Задания группе</p>
                  <TaskComposer onAdd={(text) => newTask.mutate(text)} busy={newTask.isPending} />
                  {g.tasks.length ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {g.tasks.map((t) => {
                        const done = t.status === "done";
                        return (
                          <div key={t.id} className="flex items-start gap-2.5 rounded-[13px] bg-white p-2.5" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
                            <button
                              onClick={() => { tap(); flipTask.mutate({ taskId: t.id, status: done ? "open" : "done" }); }}
                              className="ico mt-0.5 h-6 w-6 shrink-0 keep-style"
                              style={{ background: done ? EDGE : "var(--surface-2)" }}
                              aria-label={done ? "Вернуть в работу" : "Отметить выполненным"}
                            >
                              {done && <Icon name="check" width={12} weight="bold" color="#fff" />}
                            </button>
                            <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug" style={done ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                              {t.text}
                            </span>
                            <button
                              onClick={() => ask({ title: "Удалить задание?", note: t.text, confirm: "Удалить", tone: "danger", run: () => dropTask.mutate(t.id) })}
                              className="ico h-7 w-7 shrink-0 keep-style"
                              style={{ background: "var(--surface-2)" }}
                              aria-label="Удалить задание"
                            >
                              <Icon name="close" width={11} weight="bold" color="var(--muted)" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty text="Заданий пока нет. Одно задание на всю группу — участники увидят его вместе с расписанием." />
                  )}
                </>
              )}

              {/* Настройки открываются редко — держим их свёрнутыми внизу. */}
              <button
                onClick={() => { tap(); setSettings((v) => !v); }}
                aria-expanded={settings}
                className="mt-6 inline-flex min-h-9 items-center gap-1.5 text-[12px] font-black"
                style={{ color: "var(--muted)" }}
              >
                <Icon name="gear" width={14} weight="bold" color="var(--muted)" /> {settings ? "Свернуть" : "О группе и настройки"}
              </button>
              <Disclosure open={settings}>
                <GroupSettings
                  group={g}
                  busy={save.isPending}
                  onSave={(patch) => save.mutate(patch)}
                  onDelete={() => ask({
                    title: "Удалить группу?",
                    note: `«${g.title}» исчезнет вместе с составом, расписанием и заданиями. Карточки клиентов останутся на месте.`,
                    confirm: "Удалить",
                    tone: "danger",
                    run: () => drop.mutate(),
                  })}
                />
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

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-[13px] bg-white p-4 text-center text-[12px] font-semibold leading-snug text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      {text}
    </p>
  );
}

function TaskComposer({ onAdd, busy }: { onAdd: (text: string) => void; busy?: boolean }) {
  const [text, setText] = useState("");
  return (
    <div className="flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Что сделать до следующей встречи"
        className="tf min-h-[52px] flex-1 resize-none"
        maxLength={2000}
      />
      <button
        onClick={() => { tap(); onAdd(text.trim()); setText(""); }}
        disabled={!text.trim() || busy}
        className="ico h-11 w-11 shrink-0 keep-style disabled:opacity-45"
        style={{ background: EDGE }}
        aria-label="Добавить задание"
      >
        <Icon name="plus" width={19} weight="bold" color="#fff" />
      </button>
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
          сессия {no} из {cycle(group).length} · {meeting.durationMin} мин · {FORMAT_LABEL[meetFormat(group, meeting)].toLowerCase()}
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

function GroupSettings({ group, onSave, onDelete, busy }: { group: Group; onSave: (patch: GroupPatch) => void; onDelete: () => void; busy?: boolean }) {
  const [title, setTitle] = useState(group.title);
  const [capacity, setCapacity] = useState(group.capacity);
  const [format, setFormat] = useState<MeetFormat>(group.format);
  const [place, setPlace] = useState(group.place);
  const [about, setAbout] = useState(group.about);
  const [note, setNote] = useState(group.note);
  const [url, setUrl] = useState(group.resourceUrl);

  const min = Math.max(2, activeMembers(group).length);
  const dirty =
    title.trim() !== group.title ||
    capacity !== group.capacity ||
    format !== group.format ||
    place !== group.place ||
    about !== group.about ||
    note !== group.note ||
    url !== group.resourceUrl;

  return (
    <div className="mt-2 flex flex-col gap-2.5">
      <Block title="Общая информация">
        <label className="block">
          <Label>Название</Label>
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
      </Block>

      <Block title="Формат встреч">
        <div className="grid grid-cols-2 gap-2">
          {(["offline", "online"] as MeetFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => { tap(); setFormat(f); }}
              className="rounded-[13px] py-2.5 text-[13px] font-black"
              style={format === f ? { background: EDGE, color: "#fff" } : { background: "var(--surface-2)", color: "var(--muted)" }}
            >
              {FORMAT_LABEL[f]}
            </button>
          ))}
        </div>
        <label className="mt-3 block">
          <Label>{format === "online" ? "Ссылка на созвон" : "Адрес"}</Label>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder={format === "online" ? "https://" : "улица, дом, кабинет"}
            className="tf mt-1 w-full"
            maxLength={300}
          />
        </label>
      </Block>

      <Block title="Информация для участников">
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          placeholder="Правила круга, о чём группа, что взять с собой"
          className="tf w-full resize-none"
          maxLength={4000}
        />
        <label className="mt-3 block">
          <Label>Внешний ресурс</Label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="сайт, канал или чат группы" className="tf mt-1 w-full" maxLength={500} />
        </label>
      </Block>

      <Block title="Заметка ведущего">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Только для вас: динамика, что учесть на следующей встрече"
          className="tf w-full resize-none"
          maxLength={4000}
        />
      </Block>

      <Block title="Напоминания участникам">
        <Toggle on={group.remind24h} onChange={(v) => onSave({ remind24h: v })} label="За сутки до встречи" hint="приходит вечером накануне" />
        <span className="block h-px" style={{ background: "var(--edge-neutral)" }} />
        <Toggle on={group.remind2h} onChange={(v) => onSave({ remind2h: v })} label="За два часа" hint="чтобы успели выехать" />
      </Block>

      <button
        onClick={() => { tap(); onSave({ title: title.trim(), capacity, format, place: place.trim(), about, note, resourceUrl: url.trim() }); }}
        disabled={!dirty || !title.trim() || busy}
        className="btn w-full py-3"
      >
        Сохранить
      </button>
      <button onClick={() => { tap(); onDelete(); }} className="w-full py-2.5 text-[12px] font-black" style={{ color: "var(--coral-edge)" }}>
        Удалить группу
      </button>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[17px] bg-white p-3.5" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
      <p className="mb-2 text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">{title}</p>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">{children}</span>;
}
