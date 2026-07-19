"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SectionTitle } from "@/components/blocks";
import { WellbeingCard } from "@/components/wellbeing-card";
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
import { getClientTherapy } from "@/lib/therapy";

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
  const { data: therapy } = useQuery({ queryKey: ["client-therapy", id], queryFn: () => getClientTherapy(id) });

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

      {/* Статус */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { select(); patch.mutate({ status: s }); }}
            className="rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-transform active:scale-95 stroke"
            style={client.status === s ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", color: "var(--muted)" }}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Работа именно с этим терапевтом */}
      <div className="mt-6"><SectionTitle>Работа со мной</SectionTitle></div>
      <Reveal delay={0.05}>
        <div className="mt-1">
          <Card className="!p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-tight text-[32px] font-extrabold leading-none tnum">{client.sessionsDone}</p>
                <p className="mt-1 text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Встреч<br />проведено</p>
              </div>
              <span className="rounded-full px-3 py-1.5 text-[12px] font-extrabold stroke" style={{ background: "var(--head-soft)" }}>{STATUS_LABEL[client.status]}</span>
            </div>

            {/* Прогресс заданий */}
            <div className="mt-4">
              <div className="h-3.5 overflow-hidden rounded-full stroke" style={{ background: "#fff" }}>
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(4, hwPct)}%`, background: "var(--green)", borderRight: "var(--bw) solid var(--green-edge)", transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }} />
              </div>
            </div>

            {/* 3 плитки */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Tile value={client.hwTotal ? `${client.hwDone}/${client.hwTotal}` : "—"} label="Задания" />
              <Tile value={`${hwPct}%`} label="Выполнено" />
              <Tile value={moods.length ? moodWord(moods[moods.length - 1].mood) : "—"} label="Настроение" />
            </div>
          </Card>
        </div>
      </Reveal>

      {/* Общее самочувствие клиента (не привязано к терапевту) — те же сведения, что видит клиент */}
      <div className="mt-6"><SectionTitle>Общее самочувствие</SectionTitle></div>
      <Reveal delay={0.06}>
        <div className="mt-1">
          <WellbeingCard who5={therapy?.who5 ?? null} subtitle="самооценка клиента · последние две недели" />
        </div>
      </Reveal>

      {/* Настроение за неделю — цветные столбики */}
      {moods.length > 0 && (
        <Reveal delay={0.08}>
          <div className="mt-3">
            <Card className="!p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-extrabold">Настроение</p>
                <div className="flex gap-1 rounded-full p-0.5 stroke" style={{ background: "#fff" }}>
                  {["Неделя", "Месяц"].map((t, i) => (
                    <span key={t} className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={i === 0 ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted-2)" }}>{t}</span>
                  ))}
                </div>
              </div>
              <MoodBars moods={moods} />
              <p className="mt-2 text-[11px] font-medium text-[var(--muted-2)]">Отметки клиента за 7 дней · тёплое — тяжело, зелёное — хорошо</p>
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="chunk px-2.5 py-2.5 text-center">
      <p className="tnum font-tight text-[18px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</p>
    </div>
  );
}

function moodWord(m: number): string {
  return ["тяжело", "непросто", "ровно", "неплохо", "хорошо"][Math.min(4, Math.max(0, m - 1))];
}
const moodColor = (m: number) => `var(--mood-${Math.min(5, Math.max(1, m))})`;
const moodEdge = (m: number) => `color-mix(in srgb, var(--mood-${Math.min(5, Math.max(1, m))}) 62%, var(--ink))`;

/* Столбики настроения: цвет по значению (тёплое — тяжело, зелёное — хорошо) */
function MoodBars({ moods }: { moods: Mood[] }) {
  const dayF = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
  return (
    <div className="flex items-end justify-between gap-2">
      {moods.map((m, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-extrabold text-[var(--muted)]">{m.mood}</span>
          <div className="flex h-24 w-full items-end">
            <div
              className="w-full rounded-t-[10px] transition-[height] duration-500"
              style={{
                height: `${20 + (m.mood / 5) * 80}%`,
                background: moodColor(m.mood),
                border: `var(--bw) solid ${moodEdge(m.mood)}`,
                borderBottom: "none",
                transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
              }}
            />
          </div>
          <span className="text-[9px] font-bold uppercase text-[var(--muted-2)]">{dayF.format(new Date(m.date))}</span>
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
