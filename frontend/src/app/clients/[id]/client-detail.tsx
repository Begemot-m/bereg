"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SectionTitle } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { InviteButton } from "@/components/invite";
import { MoodStats } from "@/components/mood-stats";
import { WellbeingCard } from "@/components/wellbeing-card";
import { Reveal } from "@/components/motion";
import { SlotPicker } from "@/components/slot-picker";
import { Button, Card, Disclosure, Spinner, Textarea } from "@/components/ui";
import {
  deleteClient,
  derivedStatus,
  getClient,
  HW_LABEL,
  listHomework,
  listMoods,
  sendHomework,
  statusReason,
  STATUS_LABEL,
  updateClient,
  updateHomework,
  type ClientStatus,
  type Homework,
  type HwStatus,
  type Mood,
} from "@/lib/clients";
import { createAppointment, listAppointments, updateAppointment } from "@/lib/appointments";
import { select, success, tap } from "@/lib/haptics";
import { getClientTherapy } from "@/lib/therapy";

const dtf = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS_TONE: Record<ClientStatus, string> = { therapy: "green", new: "purple", paused: "amber" };

export function ClientDetail() {
  const id = Number(useParams().id);
  const router = useRouter();
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["client", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["homework", id] });
  };

  const { data: client, isLoading } = useQuery({ queryKey: ["client", id], queryFn: () => getClient(id) });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments", id], queryFn: () => listAppointments(id) });
  const { data: homework = [] } = useQuery({ queryKey: ["homework", id], queryFn: () => listHomework(id) });
  const { data: moods = [] } = useQuery({ queryKey: ["moods", id], queryFn: () => listMoods(id) });
  const { data: therapy } = useQuery({ queryKey: ["client-therapy", id], queryFn: () => getClientTherapy(id) });

  const [note, setNote] = useState("");
  const [bookOpen, setBookOpen] = useState(false);
  useEffect(() => { if (client) setNote(client.note); }, [client]);

  const patch = useMutation({ mutationFn: (p: Parameters<typeof updateClient>[1]) => updateClient(id, p), onSuccess: inv });
  const book = useMutation({ mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) => createAppointment({ clientId: id, startsAt: iso, format }), onSuccess: () => { success(); setBookOpen(false); inv(); } });
  const remove = useMutation({
    mutationFn: () => deleteClient(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); router.push("/clients"); },
  });

  if (isLoading || !client) return <div className="pt-10"><Spinner /></div>;

  const hwPct = client.hwTotal ? Math.round((client.hwDone / client.hwTotal) * 100) : 0;
  const dstatus = derivedStatus(client);
  const st = STATUS_TONE[dstatus];

  return (
    <div>
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
        ← Клиенты
      </Link>

      {/* Шапка клиента */}
      <Reveal>
        <Card className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-[16px] text-xl font-extrabold stroke fill-purple">
            {client.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-tight truncate text-2xl font-extrabold">{client.name}</h1>
            <p className="text-[13px] font-semibold text-[var(--muted)]">{client.contact || "контакт не указан"}</p>
          </div>
        </Card>
      </Reveal>

      {/* Статус — вычисляется автоматически по активности */}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full px-3 py-1.5 text-[12px] font-black" style={{ background: `var(--${st}-soft)`, border: `var(--bw) solid var(--${st}-edge)` }}>{STATUS_LABEL[dstatus]}</span>
        <span className="text-[11px] font-semibold text-[var(--muted-2)]">{statusReason(client)} · статус меняется сам</span>
      </div>

      {/* Работа именно с этим терапевтом */}
      <div className="mt-6"><SectionTitle>Работа со мной</SectionTitle></div>
      <Reveal delay={0.05}>
        <div className="mt-1">
          <Card className="!p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[16px] p-3" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }}>
                <Icon name="calendar" width={16} weight="bold" />
                <p className="mt-1.5 font-tight text-[26px] font-black leading-none tnum">{client.sessionsDone}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--muted)]">встреч проведено</p>
              </div>
              <div className="rounded-[16px] p-3" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>
                <Icon name="clock" width={16} weight="bold" />
                <p className="mt-1.5 font-tight text-[26px] font-black leading-none tnum">{client.hoursDone}<span className="text-[15px]"> ч</span></p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--muted)]">часов всего</p>
              </div>
            </div>

            {/* Прогресс заданий */}
            <div className="mt-3 flex items-center gap-2">
              <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: "#fff", border: "var(--bw) solid var(--edge-neutral)" }}>
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(4, hwPct)}%`, background: "var(--green)", transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }} />
              </div>
              <span className="text-[11px] font-black text-[var(--muted)]">задания {client.hwTotal ? `${client.hwDone}/${client.hwTotal}` : "0"}</span>
            </div>

            {/* Динамика состояния */}
            <div className="mt-3 flex items-center gap-2 rounded-[14px] p-3" style={{ background: "var(--surface-2)", border: "var(--bw) solid var(--edge-neutral)" }}>
              <MoodTrendMini moods={moods} />
              <span className="text-[11px] font-semibold text-[var(--muted)]">{moods.length >= 2 ? "динамика настроения за период" : "мало данных по настроению"}</span>
            </div>
          </Card>
        </div>
      </Reveal>

      {/* Общее самочувствие клиента (не привязано к терапевту) — те же сведения, что видит клиент */}
      <div className="mt-6"><SectionTitle>Общее самочувствие</SectionTitle></div>
      <Reveal delay={0.06}>
        <div className="mt-1">
          <WellbeingCard wheel={therapy?.wheel ?? null} subtitle="самооценка клиента · последние две недели" />
        </div>
      </Reveal>

      {/* Настроение: динамика, календарь и частые эмоции — как видит клиент */}
      {moods.length > 0 && (
        <Reveal delay={0.08}>
          <div className="mt-3">
            <MoodStats moods={moods} title="Настроение клиента" />
          </div>
        </Reveal>
      )}

      {/* Домашние задания — отдельным обрамлённым блоком с историей и процессом */}
      <div className="mt-6">
        <SectionTitle>Домашние задания</SectionTitle>
        <div className="rounded-[20px] p-3" style={{ background: "var(--surface-2)", border: "var(--bw-lg) solid var(--edge-neutral)" }}>
          <HomeworkBlock clientId={id} items={homework} onChanged={inv} />
        </div>
      </div>

      {/* История встреч + записать/пригласить */}
      <div className="mt-6">
        <SectionTitle>История встреч</SectionTitle>
        <div className="mb-2.5 flex gap-2">
          <button onClick={() => { tap(); setBookOpen(!bookOpen); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--ink)] py-2.5 text-[13px] font-black text-white transition-transform active:scale-[0.98]"><Icon name="calendar" width={15} weight="bold" /> Записать</button>
          <InviteButton variant="psy" label="Пригласить" className="flex-1 !py-2.5" />
        </div>
        <Disclosure open={bookOpen}>
          <div className="mb-2.5 rounded-[16px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
            <p className="mb-2 text-[12px] font-black uppercase tracking-wide text-[var(--muted)]">Свободное окно из вашего расписания</p>
            <SlotPicker variant="calendar" showAvail onPick={(iso, format) => book.mutate({ iso, format })} />
          </div>
        </Disclosure>
        {appts.length === 0 ? (
          <p className="text-[13px] text-[var(--muted-2)]">Встреч пока не было. Запишите клиента в свободное окно.</p>
        ) : (
          <div className="space-y-2">
            {[...appts].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((a) => {
              const t = a.status === "done" ? "green" : a.status === "scheduled" ? "purple" : "salmon";
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-[15px] bg-white p-3" style={{ border: `var(--bw) solid var(--${t}-edge)` }}>
                  <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${t})` }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black capitalize">{dtf.format(new Date(a.startsAt))}</p>
                    <p className="text-[11px] font-semibold text-[var(--muted)]">{a.durationMin} мин · {a.status === "scheduled" ? "запланирована" : a.status === "done" ? "проведена" : "отменена"} · {a.format === "online" ? "онлайн" : "очно"}</p>
                  </div>
                  {a.status === "scheduled" && (
                    <div className="flex gap-1">
                      <button onClick={() => { success(); updateAppointment(a.id, { status: "done" }).then(inv); }} className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)", color: "var(--green-edge)" }}>✓ провести</button>
                      <button onClick={() => { tap(); updateAppointment(a.id, { status: "cancelled" }).then(inv); }} className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: "#fff", border: "var(--bw) solid var(--edge-neutral)", color: "var(--muted)" }}>✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Заметки */}
      <div className="mt-6">
        <SectionTitle
          action={
            <button onClick={() => { tap(); patch.mutate({ note }); }} className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              {patch.isSuccess ? "Сохранено" : "Сохранить"}
            </button>
          }
        >
          Заметки
        </SectionTitle>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} placeholder="Приватные заметки о работе…" />
      </div>

      <button
        onClick={() => { if (confirm("Удалить клиента?")) remove.mutate(); }}
        className="mt-8 text-[12px] font-semibold text-[var(--muted-2)] hover:text-[#9f2f2d]"
      >
        Удалить клиента
      </button>
    </div>
  );
}

// Стрелка динамики настроения: сравнивает вторую половину периода с первой.
function MoodTrendMini({ moods }: { moods: Mood[] }) {
  if (moods.length < 2) return <span className="flex h-8 shrink-0 items-center rounded-[10px] bg-white px-2.5 text-[13px] font-black stroke text-[var(--muted)]">—</span>;
  const half = Math.floor(moods.length / 2);
  const avg = (arr: Mood[]) => arr.reduce((s, m) => s + m.mood, 0) / (arr.length || 1);
  const diff = avg(moods.slice(half)) - avg(moods.slice(0, half));
  const dir = diff > 0.3 ? "up" : diff < -0.3 ? "down" : "flat";
  const meta = { up: { a: "↑", c: "var(--green-edge)", w: "растёт" }, down: { a: "↓", c: "var(--salmon-edge)", w: "снижается" }, flat: { a: "→", c: "var(--muted)", w: "ровно" } }[dir];
  return <span className="flex h-8 shrink-0 items-center gap-1 rounded-[10px] bg-white px-2.5 text-[13px] font-black stroke" style={{ color: meta.c }}>{meta.a} {meta.w}</span>;
}

function HomeworkBlock({ clientId, items, onChanged }: { clientId: number; items: Homework[]; onChanged: () => void }) {
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () => sendHomework(clientId, text.trim()),
    onSuccess: () => { success(); setText(""); onChanged(); },
  });

  const done = items.filter((h) => h.status === "done").length;
  return (
    <div className="space-y-2.5">
      {/* Отправка нового задания */}
      <div className="rounded-[16px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }}><Icon name="note" width={16} weight="bold" /></span>
          <div><p className="text-[13px] font-black leading-none">Новое задание</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">Клиент увидит его в своей терапии</p></div>
        </div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Например: дневник тревоги — 3 записи за неделю" />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[var(--muted-2)]">Скоро — шаблоны техник</span>
          <Button size="sm" disabled={send.isPending || !text.trim()} onClick={() => send.mutate()} arrow>Отправить</Button>
        </div>
      </div>
      {/* История и процесс выполнения */}
      {items.length > 0 && <p className="px-1 pt-1 text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">История · {done}/{items.length} выполнено</p>}
      {items.map((h) => (
        <HomeworkRow key={h.id} hw={h} onChanged={onChanged} />
      ))}
    </div>
  );
}

const HW_FLOW: HwStatus[] = ["assigned", "doing", "done"];

function HomeworkRow({ hw, onChanged }: { hw: Homework; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(hw.text);
  const done = hw.status === "done";

  const save = useMutation({
    mutationFn: (patch: Partial<Pick<Homework, "text" | "status">>) => updateHomework(hw.id, patch),
    onSuccess: () => { setEditing(false); onChanged(); },
  });

  return (
    <div
      className="rounded-2xl p-3.5 transition-colors duration-300"
      style={{
        background: done ? "var(--good-tint)" : "var(--surface)",
        border: `1px solid ${done ? "rgba(46,125,99,0.25)" : "var(--hairline)"}`,
      }}
    >
      {editing ? (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => save.mutate({ text: text.trim() })} disabled={!text.trim()}>Сохранить</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(hw.text); }}>Отмена</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[13px] leading-relaxed ${done ? "text-[var(--good)]" : ""}`}>{hw.text}</p>
            <button onClick={() => { tap(); setEditing(true); }} className="shrink-0 text-[11px] font-semibold text-[var(--muted-2)] hover:text-[var(--ink)]">
              Изменить
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-1">
            {HW_FLOW.map((s) => {
              const activeS = hw.status === s;
              const isDone = s === "done";
              return (
                <button
                  key={s}
                  onClick={() => { isDone && !activeS ? success() : select(); save.mutate({ status: s }); }}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200"
                  style={{
                    background: activeS ? (isDone ? "var(--good)" : "var(--ink)") : "rgba(44,46,49,0.05)",
                    color: activeS ? "#fff" : "var(--muted)",
                  }}
                >
                  {HW_LABEL[s]}
                </button>
              );
            })}
            <span className="ml-auto text-[10px] text-[var(--muted-2)]">{dtf.format(new Date(hw.sentAt))}</span>
          </div>
        </>
      )}
    </div>
  );
}

