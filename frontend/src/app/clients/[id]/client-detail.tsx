"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { MoodStats } from "@/components/mood-stats";
import { PsychologistHomeworkPreview } from "@/components/psychologist-homework";
import { PsychologistSessionJourney } from "@/components/session-reflections";
import { WellbeingCard } from "@/components/wellbeing-card";
import { SlotPicker } from "@/components/slot-picker";
import { Disclosure, Input, Spinner, Textarea } from "@/components/ui";
import {
  derivedStatus,
  formatContact,
  getClient,
  inviteClient,
  isPhone,
  listHomework,
  listMoods,
  STATUS_LABEL,
  updateClient,
  type Client,
  type ClientStatus,
  type Mood,
} from "@/lib/clients";
import { createAppointment, listAppointments, updateAppointment } from "@/lib/appointments";
import { asset } from "@/lib/asset";
import { select, success, tap } from "@/lib/haptics";
import { getMonthAvailability, ymdLocal } from "@/lib/schedule";
import { getClientTherapy, setClientNotesModule } from "@/lib/therapy";

const dtf = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS_TONE: Record<ClientStatus, string> = { therapy: "green", new: "purple", paused: "amber" };

// Ссылка-приглашение клиента подключить свой профиль.
function inviteLink(id: number): string {
  const base = typeof window === "undefined" ? "https://begemot-m.github.io/bereg/" : window.location.origin + asset("/");
  return `${base}?invite=${id}`;
}

export function ClientDetail() {
  // Статический экспорт умеет отдать только заранее собранные /clients/<id>.
  // Созданные в демо клиенты получают новые id, поэтому их карточка живёт на
  // /clients/?id=N — берём идентификатор из того источника, который есть.
  const params = useParams();
  const search = useSearchParams();
  const id = Number(search.get("id") ?? params.id);
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["client", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["homework", id] });
  };

  const { data: client, isLoading, isError, refetch } = useQuery({
    queryKey: ["client", id],
    queryFn: () => getClient(id),
    // Пока приглашение «в пути» — подтягиваем карточку, чтобы поймать подключение.
    refetchInterval: (q) => (q.state.data?.link === "invited" ? 2000 : false),
  });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments", id], queryFn: () => listAppointments(id) });
  const { data: homework = [] } = useQuery({ queryKey: ["homework", id], queryFn: () => listHomework(id) });
  const { data: moods = [] } = useQuery({ queryKey: ["moods", id], queryFn: () => listMoods(id) });
  const { data: therapy } = useQuery({ queryKey: ["client-therapy", id], queryFn: () => getClientTherapy(id) });
  const notesModule = useMutation({
    mutationFn: (enabled: boolean) => setClientNotesModule(id, enabled),
    onSuccess: (state) => qc.setQueryData(["client-therapy", id], state),
  });

  const [note, setNote] = useState("");
  const [bookOpen, setBookOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [booked, setBooked] = useState<{ at: string; format: "online" | "offline" } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Календарь записи открывается на ближайшем дне со свободным окном.
  // Считается это на сервере за 60 дней вперёд — самый дорогой запрос карточки,
  // а нужен он только после нажатия «Записать на окно». SlotPicker внутри
  // спрашивает тот же ключ, так что запрос не добавляется, а переносится.
  const { data: avail } = useQuery({ queryKey: ["month-avail", false], queryFn: () => getMonthAvailability(false), enabled: bookOpen });
  const firstFree = useMemo(() => {
    if (!avail) return undefined;
    const today = ymdLocal(new Date());
    return Object.keys(avail).filter((day) => day >= today && avail[day] === "free").sort()[0];
  }, [avail]);
  useEffect(() => { if (client) setNote(client.note); }, [client]);

  // Ближайшая запись нужна и кнопке записи, и шапке — считаем до ранних возвратов.
  const nextAppt = useMemo(
    () => appts
      .filter((a) => a.status === "scheduled" && new Date(a.startsAt) > new Date())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [appts],
  );
  const apptDay = nextAppt ? ymdLocal(new Date(nextAppt.startsAt)) : undefined;

  const patch = useMutation({ mutationFn: (p: Parameters<typeof updateClient>[1]) => updateClient(id, p), onSuccess: inv });
  const book = useMutation({
    // «Перезаписать» переносит текущую сессию, а не заводит вторую рядом.
    mutationFn: ({ iso, format }: { iso: string; format: "online" | "offline" }) =>
      nextAppt
        ? updateAppointment(nextAppt.id, { startsAt: iso, format })
        : createAppointment({ clientId: id, startsAt: iso, format }),
    onSuccess: (_, vars) => { success(); setBooked({ at: vars.iso, format: vars.format }); inv(); },
  });
  // Упавший запрос выглядел как вечная загрузка: isLoading уже false, а client
  // так и не появился — условие ниже оставалось истинным навсегда.
  if (isError) return (
    <div className="pt-10 text-center">
      <p className="t-sub">Не удалось загрузить карточку клиента.</p>
      <button onClick={() => void refetch()} className="btn btn-accent mt-4">Повторить</button>
    </div>
  );
  if (isLoading || !client) return <div className="pt-10"><Spinner /></div>;

  const dstatus = derivedStatus(client);
  const st = STATUS_TONE[dstatus];

  const held = appts.filter((a) => a.status === "done").length;
  // «Написать» ведёт в личный чат Telegram, если контакт — это username.
  const tgLink = client.contact && !isPhone(client.contact)
    ? `https://t.me/${client.contact.replace(/^@/, "")}?text=${encodeURIComponent("Здравствуйте! Пишу из «Хроники».")}`
    : null;

  return (
    <div className="-mx-4 -mt-6 @md:-mx-9">
      {/* Шапка клиента: цвет = фон раздела, ниже скруглённая линия */}
      <header className="bg-[var(--page)] px-4 pb-14 pt-4 @md:px-9">
        <Link href="/clients" className="back-link mb-3">Все клиенты</Link>
        <div className="flex items-start gap-3.5">
          {/* Крупная рамка фото */}
          <div className="flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-[22px] text-[34px] font-black" style={{ background: `var(--${st}-soft)`, border: `var(--bw-lg) solid var(--${st}-edge)` }}>{client.name.charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <h1 className="font-tight break-words text-[clamp(19px,5.6vw,22px)] font-black leading-tight">{client.name}</h1>
            {client.contact
              ? <span className="t-cap mt-1 block">{formatContact(client.contact)}</span>
              : <span className="mt-1 block text-[12px] font-semibold text-[var(--muted-2)]">Контакт не указан</span>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {/* Статус клиента — серый: это состояние, а не акцент */}
              <span className="inline-flex rounded-full px-2 py-1 text-[11.5px] font-black" style={{ background: "var(--alt-soft)", color: "var(--alt-edge)" }}>{STATUS_LABEL[dstatus]}</span>
              {client.link === "joined" ? (
                <span className="inline-flex items-center gap-1 px-1 py-1 text-[11.5px] font-black" style={{ color: "var(--green-edge)" }}>
                  <Icon name="check" width={11} weight="bold" color="var(--green-edge)" /> Профиль подключён
                </span>
              ) : (
                <button
                  onClick={() => { tap(); setConnectOpen((v) => !v); setBookOpen(false); }}
                  aria-expanded={connectOpen}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-black"
                  style={{ background: "var(--alt-soft)", color: "var(--alt-edge)" }}
                >
                  <Icon name={client.link === "invited" ? "clock" : "spark"} width={11} weight="bold" color="var(--alt-edge)" />
                  {client.link === "invited" ? "Приглашение отправлено" : "Профиль не подключён"}
                </button>
              )}
            </div>
            {/* Ближайшая встреча — как в разделе «Терапия» */}
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-black" style={{ color: nextAppt ? "var(--green-edge)" : "var(--muted-2)" }}>
              <Icon name="calendar" width={12} weight="bold" color={nextAppt ? "var(--green-edge)" : "var(--muted-2)"} />
              {nextAppt ? `Ближайшая запись ${dtf.format(new Date(nextAppt.startsAt))} · ${nextAppt.format === "online" ? "онлайн" : "очно"}` : "встреча пока не назначена"}
            </p>
          </div>
        </div>

        {/* Кнопки — в тонах приложения */}
        <div className="mt-4 flex gap-2">
          <button onClick={() => { tap(); setBookOpen((v) => !v); setConnectOpen(false); }} className={`btn flex-1 py-3 ${bookOpen ? "btn-white" : "btn-accent"}`} aria-expanded={bookOpen}>
            <Icon name="calendar" width={15} weight="bold" color={bookOpen ? "var(--edge)" : "#fff"} /> {bookOpen ? "Свернуть" : nextAppt ? "Перезаписать" : "Записать на окно"}
          </button>
          {tgLink ? (
            <a href={tgLink} target="_blank" rel="noopener noreferrer" onClick={tap} className="btn flex-1 py-3"><Icon name="telegram" width={15} weight="fill" color="#fff" /> Написать</a>
          ) : (
            <button onClick={() => { tap(); setConnectOpen((v) => !v); setBookOpen(false); }} className="btn flex-1 py-3"><Icon name="telegram" width={15} weight="fill" color="#fff" /> Написать</button>
          )}
        </div>
        {/* Динамичный разворот выбора окна */}
        <AnimatePresence initial={false}>
          {bookOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="overflow-hidden">
              <motion.div initial={{ y: -8, scale: 0.98 }} animate={{ y: 0, scale: 1 }} transition={{ delay: 0.05 }} className="card-plain mt-2.5 p-3">
                {booked ? (
                  <div className="text-center">
                    <p className="text-[13px] font-black">{client.name} записан</p>
                    <p className="t-cap mt-1 capitalize">{dtf.format(new Date(booked.at))} · {booked.format === "online" ? "онлайн" : "очно"}</p>
                    <button onClick={() => { tap(); setBooked(null); setBookOpen(false); }} className="btn mt-2.5 px-4 py-1.5 text-[11px]">Готово</button>
                  </div>
                ) : (
                  <>
                    <p className="t-micro mb-2">{nextAppt ? "Новое время вместо текущей записи" : "Свободное окно из вашего расписания"}</p>
                    {/* Есть запись — открываемся на её дне, иначе на ближайшем свободном */}
                    <SlotPicker variant="calendar" showAvail startDay={apptDay ?? firstFree} appts={appts} onPick={(iso, format) => book.mutate({ iso, format })} />
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Подключение клиента: контакт + приглашение + авто-синхронизация */}
        <Disclosure open={connectOpen} autoScroll={false}>
          <ClientConnect client={client} onChanged={inv} />
        </Disclosure>
      </header>

      <main className="-mt-8 space-y-4 rounded-t-[27px] bg-white px-4 pb-10 pt-6 @md:px-9">
        <PsychologistHomeworkPreview items={homework} href={`/clients/homework?id=${id}`} />

        {therapy && <PsychologistSessionJourney meetings={appts} reflections={therapy.reflections} module={therapy.notesModule} saving={notesModule.isPending} onToggle={() => notesModule.mutateAsync(!therapy.notesModule.psychologistEnabled)} href={`/clients/notes?id=${id}`} />}

        {/* Настроение и динамика — выше колеса */}
        {moods.length > 0 && <MoodStats moods={moods} title="Настроение клиента" />}

        <WellbeingCard wheel={therapy?.wheel ?? null} subtitle="самооценка клиента · последние две недели" />

        {/* История встреч — факт. Запланированную по тапу переносим на другое окно */}
        <div>
          <button onClick={() => { tap(); setHistoryOpen((v) => !v); }} className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-3 text-[13px] font-black" style={{ background: "var(--alt-soft)", color: "var(--ink)" }} aria-expanded={historyOpen}>
            <span className="inline-flex items-center gap-2"><Icon name="calendar" width={15} weight="bold" /> История встреч</span>
            <span className="inline-flex items-center gap-2 text-[11px] font-black text-[var(--muted)]">проведено: {held} <span>{historyOpen ? "↑" : "→"}</span></span>
          </button>
          <Disclosure open={historyOpen}>
            <div className="mt-2">
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
          </Disclosure>
        </div>

        {/* Заметки */}
        <div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} placeholder="Приватные заметки о работе…" />
          <button onClick={() => { tap(); patch.mutate({ note }); }} className="btn btn-accent mt-2 w-full py-2.5">{patch.isSuccess ? "Сохранено" : "Сохранить"}</button>
        </div>

      </main>
    </div>
  );
}

// Панель подключения: контакт (Telegram/телефон) + приглашение. После входа клиента
// карточка синхронизируется автоматически (в демо — через пару секунд).
function ClientConnect({ client, onChanged }: { client: Client; onChanged: () => void }) {
  const [kind, setKind] = useState<"tg" | "phone">(() => (client.contact && isPhone(client.contact) ? "phone" : "tg"));
  const [contact, setContact] = useState(client.contact ?? "");
  const [copied, setCopied] = useState(false);
  const link = inviteLink(client.id);
  const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Веду вас в «Хронику» — подключите свой профиль, чтобы видеть записи, задания и практики:")}`;

  const invite = useMutation({ mutationFn: () => inviteClient(client.id, contact.trim()), onSuccess: () => { success(); onChanged(); } });
  const saveContact = useMutation({ mutationFn: () => updateClient(client.id, { contact: contact.trim() }), onSuccess: () => { tap(); onChanged(); } });
  const copy = async () => { try { await navigator.clipboard.writeText(link); success(); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } };

  return (
    <div className="card-plain mt-2.5 p-3.5">
      {/* Контакт */}
      <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Контакт клиента</p>
      <div className="mb-2 flex gap-1 rounded-full p-1" style={{ background: "var(--head-soft)" }}>
        {([["tg", "Telegram"], ["phone", "Телефон"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { select(); setKind(k); }} className="flex-1 rounded-full py-1.5 text-[12px] font-extrabold transition-colors" style={kind === k ? { background: "var(--ink)", color: "#fff" } : { color: "var(--muted)" }}>{label}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={kind === "tg" ? "@username" : "+7 900 000-00-00"} inputMode={kind === "phone" ? "tel" : "text"} />
        <button onClick={() => saveContact.mutate()} disabled={saveContact.isPending || contact.trim() === (client.contact ?? "")} className="btn btn-accent shrink-0 px-3 text-[12px]">Сохранить</button>
      </div>

      {/* Состояние подключения + приглашение */}
      <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--edge-neutral)" }}>
        {client.link === "joined" ? (
          <div className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }}>
            <Icon name="check" width={18} weight="bold" color="var(--green-edge)" />
            <div><p className="text-[12.5px] font-black leading-tight">Профиль клиента подключён</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">Настроение, задания и записи синхронизируются автоматически.</p></div>
          </div>
        ) : client.link === "invited" ? (
          <>
            <div className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5" style={{ background: "var(--amber-soft)", border: "var(--bw) solid var(--amber-edge)" }}>
              <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--amber-edge)" }} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "var(--amber-edge)" }} /></span>
              <div className="min-w-0 flex-1"><p className="text-[12.5px] font-black leading-tight">Ждём подключения…</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">{client.invitedAt ? `Отправлено ${dtf.format(new Date(client.invitedAt))}. ` : ""}Когда клиент войдёт по ссылке — карточка обновится сама.</p></div>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={copy} className="btn btn-accent flex-1 py-2 text-[12px]">{copied ? "Ссылка скопирована" : "Скопировать ссылку"}</button>
              <a href={share} target="_blank" rel="noopener noreferrer" className="btn btn-accent flex-1 py-2 text-[12px]"><Icon name="spark" width={13} weight="fill" /> В Telegram</a>
            </div>
          </>
        ) : (
          <>
            <p className="text-[12px] font-semibold text-[var(--muted)]">Пригласите клиента — он войдёт по ссылке, подключит свой профиль, и карточка синхронизируется: настроение, задания, записи.</p>
            <button onClick={() => invite.mutate()} disabled={invite.isPending} className="btn btn-accent mt-2.5 w-full py-2.5"><Icon name="spark" width={15} weight="fill" /> Пригласить подключиться</button>
            <a href={share} target="_blank" rel="noopener noreferrer" onClick={() => invite.mutate()} className="mt-1.5 flex w-full items-center justify-center gap-1.5 py-1.5 text-[12px] font-black text-[var(--muted)] hover:text-[var(--ink)]"><Icon name="spark" width={13} weight="fill" /> Отправить приглашение в Telegram</a>
          </>
        )}
      </div>
    </div>
  );
}

// Встреча в истории: факт. Запланированную по тапу разворачиваем в перенос.
function MeetingRow({ appt, onReschedule }: { appt: { id: number; startsAt: string; durationMin: number; status: string; format: "online" | "offline" }; onReschedule: (iso: string, format: "online" | "offline") => void }) {
  const [open, setOpen] = useState(false);
  const t = appt.status === "done" ? "green" : appt.status === "scheduled" ? "purple" : "salmon";
  const planned = appt.status === "scheduled";
  return (
    <div className="overflow-hidden rounded-[14px] bg-white" style={{ border: `var(--bw) solid var(--${t}-edge)` }}>
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
              <SlotPicker variant="strip" daysAhead={21} onPick={(iso, format) => { setOpen(false); onReschedule(iso, format); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

