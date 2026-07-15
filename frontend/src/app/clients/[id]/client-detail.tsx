"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SectionTitle } from "@/components/blocks";
import { Reveal } from "@/components/motion";
import { Button, Card, Input, Spinner, Textarea } from "@/components/ui";
import {
  deleteClient,
  getClient,
  HW_LABEL,
  listHomework,
  listMoods,
  sendHomework,
  STATUS_LABEL,
  updateClient,
  updateHomework,
  type ClientStatus,
  type Homework,
  type HwStatus,
  type Mood,
} from "@/lib/clients";
import { createAppointment, deleteAppointment, listAppointments, updateAppointment } from "@/lib/appointments";
import { select, success, tap } from "@/lib/haptics";

const dtf = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUSES: ClientStatus[] = ["therapy", "new", "paused"];

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

  const [note, setNote] = useState("");
  useEffect(() => { if (client) setNote(client.note); }, [client]);

  const patch = useMutation({ mutationFn: (p: Parameters<typeof updateClient>[1]) => updateClient(id, p), onSuccess: inv });
  const remove = useMutation({
    mutationFn: () => deleteClient(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); router.push("/clients"); },
  });

  if (isLoading || !client) return <div className="pt-10"><Spinner /></div>;

  const hwPct = client.hwTotal ? Math.round((client.hwDone / client.hwTotal) * 100) : 0;

  return (
    <div>
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
        ← Клиенты
      </Link>

      {/* Шапка-«персонаж» */}
      <Reveal>
        <Card className="!p-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-extrabold" style={{ background: "var(--a-tint)", color: "var(--a1)" }}>
              {client.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-tight truncate text-2xl font-extrabold">{client.name}</h1>
              <p className="text-[13px] text-[var(--muted)]">{client.contact || "контакт не указан"}</p>
            </div>
          </div>

          {/* Статы */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Встреч" value={String(client.sessionsDone)} />
            <Stat label="Задания" value={client.hwTotal ? `${client.hwDone}/${client.hwTotal}` : "—"} good={hwPct === 100 && client.hwTotal > 0} />
            <Stat label="Настроение" value={moods.length ? moodWord(moods[moods.length - 1].mood) : "—"} />
          </div>

          {/* Прогресс выполнения заданий */}
          {client.hwTotal > 0 && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${hwPct}%`, background: "var(--good)", transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }}
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted-2)]">Выполнение заданий · {hwPct}%</p>
            </div>
          )}

          {/* Статус */}
          <div className="mt-4 flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { select(); patch.mutate({ status: s }); }}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-200 ${client.status === s ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Card>
      </Reveal>

      {/* Между сессиями: настроение за неделю */}
      {moods.length > 0 && (
        <Reveal delay={0.05}>
          <div className="mt-6">
            <SectionTitle>Между сессиями</SectionTitle>
            <Card className="!p-4">
              <MoodSpark moods={moods} />
              <p className="mt-2 text-[11px] text-[var(--muted-2)]">Отметки настроения клиента за 7 дней (1 — тяжело, 5 — хорошо)</p>
            </Card>
          </div>
        </Reveal>
      )}

      {/* Домашние задания */}
      <div className="mt-6">
        <SectionTitle>Домашние задания</SectionTitle>
        <HomeworkBlock clientId={id} items={homework} onChanged={inv} />
      </div>

      {/* Записи */}
      <div className="mt-6">
        <SectionTitle>Записи</SectionTitle>
        <div className="space-y-2">
          <AddAppt clientId={id} onDone={inv} />
          {appts.length === 0 ? (
            <p className="text-[13px] text-[var(--muted-2)]">Записей нет.</p>
          ) : (
            appts.map((a) => (
              <Card key={a.id} className="!p-3">
                <div className="flex items-center gap-3">
                  <span className={`h-8 w-1 rounded-full`} style={{ background: a.status === "scheduled" ? "var(--a1)" : "var(--hairline)" }} />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold capitalize">{dtf.format(new Date(a.startsAt))}</p>
                    <p className="text-[11px] text-[var(--muted-2)]">
                      {a.durationMin} мин · {a.status === "scheduled" ? "запланирована" : a.status === "done" ? "проведена" : "отменена"}
                    </p>
                  </div>
                  {a.status === "scheduled" && (
                    <div className="flex gap-1">
                      <button onClick={() => { success(); updateAppointment(a.id, { status: "done" }).then(inv); }} className="rounded-full bg-[var(--good-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--good)]">✓</button>
                      <button onClick={() => { tap(); deleteAppointment(a.id).then(inv); }} className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">✕</button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
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

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: good ? "var(--good-tint)" : "var(--surface-2)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-2)]">{label}</p>
      <p className={`tnum text-[17px] font-extrabold ${good ? "text-[var(--good)]" : ""}`}>{value}</p>
    </div>
  );
}

function moodWord(m: number): string {
  return ["тяжело", "непросто", "ровно", "неплохо", "хорошо"][Math.min(4, Math.max(0, m - 1))];
}

/* Спарклайн настроения: столбики по дням, высота = настроение */
function MoodSpark({ moods }: { moods: Mood[] }) {
  const dayF = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
  return (
    <div className="flex items-end justify-between gap-1.5">
      {moods.map((m, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-14 w-full items-end">
            <div
              className="w-full rounded-md transition-[height] duration-500"
              style={{
                height: `${(m.mood / 5) * 100}%`,
                background: m.mood >= 4 ? "var(--good)" : m.mood === 3 ? "var(--a2)" : "#c9a13d",
                opacity: 0.85,
                transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
              }}
            />
          </div>
          <span className="text-[9px] font-semibold uppercase text-[var(--muted-2)]">{dayF.format(new Date(m.date))}</span>
        </div>
      ))}
    </div>
  );
}

/* Домашки: статусы + редактирование текста */
function HomeworkBlock({ clientId, items, onChanged }: { clientId: number; items: Homework[]; onChanged: () => void }) {
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () => sendHomework(clientId, text.trim()),
    onSuccess: () => { success(); setText(""); onChanged(); },
  });

  return (
    <div className="space-y-2.5">
      <Card className="!p-3">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Новое задание клиенту… (скоро — шаблоны техник)" />
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={send.isPending || !text.trim()} onClick={() => send.mutate()} arrow>Отправить</Button>
        </div>
      </Card>
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

function AddAppt({ clientId, onDone }: { clientId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const add = useMutation({
    mutationFn: () => createAppointment({ clientId, startsAt, durationMin: 60 }),
    onSuccess: () => { success(); setOpen(false); setStartsAt(""); onDone(); },
  });
  if (!open)
    return (
      <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
        + Записать на сессию
      </Button>
    );
  return (
    <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); if (startsAt) add.mutate(); }}>
      <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} autoFocus />
      <Button type="submit" size="sm" disabled={add.isPending}>OK</Button>
    </form>
  );
}
