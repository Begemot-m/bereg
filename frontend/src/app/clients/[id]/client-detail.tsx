"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SectionTitle } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { InviteButton } from "@/components/invite";
import { MoodStats } from "@/components/mood-stats";
import { WellbeingCard } from "@/components/wellbeing-card";
import { SlotPicker } from "@/components/slot-picker";
import { Button, Spinner, Textarea } from "@/components/ui";
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
  deleteHomework,
  type ClientStatus,
  type Homework,
  type HwStatus,
  type Mood,
} from "@/lib/clients";
import { createAppointment, listAppointments, updateAppointment } from "@/lib/appointments";
import { success, tap } from "@/lib/haptics";
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

  const dstatus = derivedStatus(client);
  const st = STATUS_TONE[dstatus];

  const held = appts.filter((a) => a.status === "done").length;

  return (
    <div className="-mx-4 -mt-6 @md:-mx-9">
      {/* Шапка клиента: цвет = фон раздела, ниже скруглённая линия */}
      <header className="bg-[var(--page)] px-4 pb-14 pt-4 @md:px-9">
        <Link href="/clients" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">← Клиенты</Link>
        <div className="flex items-center gap-3.5">
          {/* Крупная рамка фото */}
          <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[20px] text-[26px] font-black" style={{ background: `var(--${st}-soft)`, border: `var(--bw-lg) solid var(--${st}-edge)` }}>{client.name.charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <h1 className="font-tight truncate text-[22px] font-black leading-tight">{client.name}</h1>
            {client.contact
              ? <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--muted)]"><Icon name="spark" width={12} weight="fill" /> {client.contact.startsWith("@") ? client.contact : `@${client.contact}`}</span>
              : <span className="mt-1 block text-[12px] font-semibold text-[var(--muted-2)]">Telegram не указан</span>}
          </div>
          {/* Статус — правее имени и аватарки */}
          <span className="shrink-0 self-start rounded-full px-3 py-1.5 text-[11px] font-black" style={{ background: `var(--${st}-soft)`, border: `var(--bw) solid var(--${st}-edge)`, color: `var(--${st}-edge)` }}>{STATUS_LABEL[dstatus]}</span>
        </div>
        <p className="mt-2 text-[11px] font-semibold text-[var(--muted-2)]">{statusReason(client)} · статус меняется сам</p>

        {/* Кнопки — в тонах приложения */}
        <div className="mt-4 flex gap-2">
          <button onClick={() => { tap(); setBookOpen(!bookOpen); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-[13px] font-black transition-transform active:scale-[0.98]" style={{ background: bookOpen ? "var(--olive)" : "var(--olive-soft)", border: "var(--bw-lg) solid var(--olive-edge)" }}><Icon name="calendar" width={15} weight="bold" /> Записать на окно</button>
          <InviteButton variant="psy" label="Пригласить в терапию" className="flex-1 !py-3 !bg-[var(--purple)] !text-[var(--ink)] [border:var(--bw-lg)_solid_var(--purple-edge)]" />
        </div>
        {/* Динамичный разворот выбора окна */}
        <AnimatePresence initial={false}>
          {bookOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="overflow-hidden">
              <motion.div initial={{ y: -8, scale: 0.98 }} animate={{ y: 0, scale: 1 }} transition={{ delay: 0.05 }} className="mt-2.5 rounded-[18px] bg-white p-3" style={{ border: "var(--bw-lg) solid var(--olive-edge)" }}>
                <p className="mb-2 text-[12px] font-black uppercase tracking-wide text-[var(--muted)]">Свободное окно из вашего расписания</p>
                <SlotPicker variant="calendar" showAvail onPick={(iso, format) => book.mutate({ iso, format })} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="-mt-8 space-y-6 rounded-t-[30px] bg-[#fffdf7] px-4 pb-10 pt-6 @md:px-9" style={{ borderTop: "var(--bw-lg) solid var(--edge-neutral)" }}>
        {/* Динамика встреч — упрощённо: только число проведённых */}
        <SessionsCounter done={client.sessionsDone} hours={client.hoursDone} />

        {/* Настроение и динамика — выше колеса */}
        {moods.length > 0 && (
          <div>
            <SectionTitle>Настроение клиента</SectionTitle>
            <MoodStats moods={moods} title="Настроение клиента" />
          </div>
        )}

        {/* Колесо баланса — ниже */}
        <div>
          <SectionTitle>Колесо баланса</SectionTitle>
          <WellbeingCard wheel={therapy?.wheel ?? null} subtitle="самооценка клиента · последние две недели" />
        </div>

        {/* Домашние задания: статусы правит клиент сам; вы — только текст и удаление */}
        <div>
          <SectionTitle>Домашние задания</SectionTitle>
          <div className="rounded-[20px] p-3" style={{ background: "var(--surface-2)", border: "var(--bw-lg) solid var(--edge-neutral)" }}>
            <HomeworkBlock clientId={id} items={homework} onChanged={inv} />
          </div>
        </div>

        {/* История встреч — факт. Запланированную по тапу переносим на другое окно */}
        <div>
          <SectionTitle action={<span className="text-[11px] font-black text-[var(--muted)]">проведено: {held}</span>}>История встреч</SectionTitle>
          {appts.length === 0 ? (
            <p className="text-[13px] text-[var(--muted-2)]">Встреч пока не было. Запишите клиента в свободное окно.</p>
          ) : (
            <div className="space-y-2">
              {[...appts].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((a) => (
                <MeetingRow key={a.id} appt={a} onReschedule={(iso, format) => updateAppointment(a.id, { startsAt: iso, format }).then(() => { success(); inv(); })} />
              ))}
            </div>
          )}
        </div>

        {/* Заметки */}
        <div>
          <SectionTitle action={<button onClick={() => { tap(); patch.mutate({ note }); }} className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]">{patch.isSuccess ? "Сохранено" : "Сохранить"}</button>}>Заметки</SectionTitle>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} placeholder="Приватные заметки о работе…" />
        </div>

        <button onClick={() => { if (confirm("Удалить клиента?")) remove.mutate(); }} className="text-[12px] font-semibold text-[var(--muted-2)] hover:text-[#9f2f2d]">Удалить клиента</button>
      </main>
    </div>
  );
}

// Упрощённая динамика: крупное число проведённых сессий (в стиле рефов).
function SessionsCounter({ done, hours }: { done: number; hours: number }) {
  return (
    <section className="flex items-center gap-4 rounded-[22px] bg-white p-4" style={{ border: "var(--bw-lg) solid var(--green-edge)" }}>
      <div className="flex h-[76px] w-[76px] shrink-0 flex-col items-center justify-center rounded-[20px]" style={{ background: "var(--green-soft)", border: "var(--bw-lg) solid var(--green-edge)" }}>
        <span className="font-tight tabular-nums text-[32px] font-black leading-none">{done}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[.1em] text-[var(--muted)]">Динамика встреч</p>
        <p className="text-[17px] font-black leading-tight">{done > 0 ? `${done} проведённых сессий` : "Сессий ещё не было"}</p>
        {hours > 0 && <p className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">{hours} ч вместе за всё время</p>}
      </div>
    </section>
  );
}

// Встреча в истории: факт. Запланированную по тапу разворачиваем в перенос.
function MeetingRow({ appt, onReschedule }: { appt: { id: number; startsAt: string; durationMin: number; status: string; format: "online" | "offline" }; onReschedule: (iso: string, format: "online" | "offline") => void }) {
  const [open, setOpen] = useState(false);
  const t = appt.status === "done" ? "green" : appt.status === "scheduled" ? "purple" : "salmon";
  const planned = appt.status === "scheduled";
  return (
    <div className="overflow-hidden rounded-[15px] bg-white" style={{ border: `var(--bw) solid var(--${t}-edge)` }}>
      <button onClick={() => planned && (tap(), setOpen(!open))} className="flex w-full items-center gap-3 p-3 text-left" disabled={!planned}>
        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${t})` }} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black capitalize">{dtf.format(new Date(appt.startsAt))}</p>
          <p className="text-[11px] font-semibold text-[var(--muted)]">{appt.durationMin} мин · {appt.status === "scheduled" ? "запланирована" : appt.status === "done" ? "проведена" : "отменена"} · {appt.format === "online" ? "онлайн" : "очно"}</p>
        </div>
        {planned && <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: "var(--olive-soft)", border: "var(--bw) solid var(--olive-edge)", color: "var(--olive-edge)" }}>{open ? "Свернуть" : "Перенести"}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && planned && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="overflow-hidden">
            <div className="border-t p-3" style={{ borderColor: "var(--edge-neutral)" }}>
              <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Новое окно для встречи</p>
              <SlotPicker variant="calendar" showAvail onPick={(iso, format) => { setOpen(false); onReschedule(iso, format); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

const HW_TONE: Record<HwStatus, string> = { assigned: "amber", doing: "purple", done: "green" };

// Статус задания меняет клиент сам (в своей терапии). Психолог правит текст или удаляет.
function HomeworkRow({ hw, onChanged }: { hw: Homework; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(hw.text);
  const done = hw.status === "done";
  const tone = HW_TONE[hw.status];

  const save = useMutation({
    mutationFn: (patch: Partial<Pick<Homework, "text">>) => updateHomework(hw.id, patch),
    onSuccess: () => { setEditing(false); onChanged(); },
  });
  const del = useMutation({ mutationFn: () => deleteHomework(hw.id), onSuccess: () => { tap(); onChanged(); } });

  return (
    <div className="rounded-[16px] bg-white p-3" style={{ border: `var(--bw) solid var(--${tone}-edge)` }}>
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
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 h-8 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${tone})` }} />
            <p className={`flex-1 text-[12.5px] font-bold leading-snug ${done ? "opacity-55 line-through" : ""}`}>{hw.text}</p>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {/* Статус — только для чтения: его выставляет клиент */}
            <span className="rounded-full px-2.5 py-1 text-[10.5px] font-black" style={{ background: `var(--${tone}-soft)`, border: `var(--bw) solid var(--${tone}-edge)` }}>{HW_LABEL[hw.status]}</span>
            <span className="text-[10px] font-semibold text-[var(--muted-2)]">{dtf.format(new Date(hw.sentAt))}</span>
            <div className="ml-auto flex gap-1">
              <button onClick={() => { tap(); setEditing(true); }} className="rounded-full px-2.5 py-1 text-[11px] font-black text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>Поправить</button>
              <button onClick={() => { if (confirm("Удалить задание?")) del.mutate(); }} className="rounded-full px-2.5 py-1 text-[11px] font-black text-[var(--muted-2)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>Удалить</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

