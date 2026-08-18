"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ArrowGlyph } from "@/components/blocks";
import { ClientAvatar } from "@/components/client-avatar";
import { useConfirmAsk } from "@/components/confirm-ask";
import { Icon } from "@/components/icons";
import { EmotionChips, MoodStats, topEmotions } from "@/components/mood-stats";
import { PsychologistHomeworkPreview } from "@/components/psychologist-homework";
import { PsychologistSessionJourney } from "@/components/session-reflections";
import { TherapistBoardView } from "@/components/therapy-work";
import { WellbeingCard } from "@/components/wellbeing-card";
import { SlotPicker } from "@/components/slot-picker";
import { NewSlotCell, SlotCell, useDayWindows } from "@/components/week-windows";
import { Disclosure, Input, PageLoader, Textarea } from "@/components/ui";
import { InviteShare } from "@/components/invite-share";
import {
  deleteClient,
  derivedStatus,
  detachClient,
  formatContact,
  getClient,
  inviteClient,
  isPhone,
  listHomework,
  listMoods,
  STATUS_LABEL,
  updateClient,
  verbEnding,
  type Client,
  type ClientStatus,
  type Mood,
} from "@/lib/clients";
import { plural } from "@/lib/daily";
import { createAppointment, listAppointments, updateAppointment } from "@/lib/appointments";
import { success, tap } from "@/lib/haptics";
import { inviteDeepLink } from "@/lib/invite";
import { getMonthAvailability, ymdLocal } from "@/lib/schedule";
import { getClientTherapy, setClientNotesModule } from "@/lib/therapy";

import { zoneDay, zoneFormat } from "@/lib/zone";

const dtf = zoneFormat({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS_TONE: Record<ClientStatus, string> = { therapy: "green", new: "purple", paused: "amber" };

// Ссылка-приглашение клиента подключить свой профиль. Ведёт в мини-приложение
// бота, а не на сайт: человек сразу оказывается внутри под своим аккаунтом.
// В метке подписанный код карточки, а не её номер: по номеру перебором
// подключались бы к чужой.
function inviteLink(client: Client): string {
  return inviteDeepLink("card", client.inviteToken ?? String(client.id));
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
    // Запись из карточки занимает окно — календарь и слоты обязаны это увидеть,
    // иначе только что занятое время остаётся зелёным до перезагрузки.
    qc.invalidateQueries({ queryKey: ["slots"] });
    qc.invalidateQueries({ queryKey: ["month-avail"] });
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
  // В свёрнутом виде хватает трёх: длинный список плашек ломает миниатюру.
  const topMoodEmotions = useMemo(() => topEmotions(moods, 3), [moods]);
  const { data: therapy } = useQuery({ queryKey: ["client-therapy", id], queryFn: () => getClientTherapy(id) });
  const notesModule = useMutation({
    mutationFn: (enabled: boolean) => setClientNotesModule(id, enabled),
    onSuccess: (state) => qc.setQueryData(["client-therapy", id], state),
  });

  const [note, setNote] = useState("");
  // С главной («Управление записью») приходим сразу с раскрытым календарём.
  const [bookOpen, setBookOpen] = useState(() => search.get("book") === "1");
  const [connectOpen, setConnectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Какой день открыт в календаре записи — под ним рисуем плитки дня.
  const [pickDay, setPickDay] = useState<string | null>(null);
  const todayY = ymdLocal(new Date());
  const [booked, setBooked] = useState<{ at: string; format: "online" | "offline" } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  // Календарь записи открывается на ближайшем дне со свободным окном.
  // Считается это на сервере за 60 дней вперёд — самый дорогой запрос карточки,
  // а нужен он только после нажатия «Записать на окно». SlotPicker внутри
  // спрашивает тот же ключ, так что запрос не добавляется, а переносится.
  const { data: avail } = useQuery({ queryKey: ["month-avail", null], queryFn: () => getMonthAvailability(), enabled: bookOpen });
  const firstFree = useMemo(() => {
    if (!avail) return undefined;
    const today = ymdLocal(new Date());
    return Object.keys(avail).filter((day) => day >= today && avail[day] === "free").sort()[0];
  }, [avail]);
  useEffect(() => { if (client) setNote(client.note); }, [client]);
  useEffect(() => { if (search.get("book") === "1") setBookOpen(true); }, [search]);

  // Ближайшая запись нужна и кнопке записи, и шапке — считаем до ранних возвратов.
  const nextAppt = useMemo(
    () => appts
      .filter((a) => a.status === "scheduled" && new Date(a.startsAt) > new Date())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [appts],
  );
  const apptDay = nextAppt ? ymdLocal(new Date(nextAppt.startsAt)) : undefined;

  const { ask, askNode } = useConfirmAsk();
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
  if (isLoading || !client) return <PageLoader label="Открываем карточку" />;

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
        <Link href="/clients" className="back-link mb-3 mt-3">Все клиенты</Link>
        <div className="flex items-start gap-3.5">
          {/* Крупная рамка фото */}
          {/* Пока клиент не подключился, фото у него нет — толстая рамка вокруг
              буквы выглядела как обводка пустоты. Такому клиенту рамка тонкая. */}
          <ClientAvatar name={client.name} photo={client.photo} className="h-[92px] w-[92px] rounded-[22px] text-[34px] font-black" style={{ background: `var(--${st}-soft)`, border: `${client.link === "joined" ? "var(--bw-lg)" : "var(--bw)"} solid var(--${st}-edge)` }} />
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
                // Клиент ещё не подключился — карточку целиком ведёт психолог,
                // и полезнее кнопка правки, чем надпись о том, чего нет.
                <button
                  onClick={() => { tap(); setEditOpen((v) => !v); setConnectOpen(false); setBookOpen(false); }}
                  aria-expanded={editOpen}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-black"
                  style={{ background: "var(--alt-soft)", color: "var(--alt-edge)" }}
                >
                  <Icon name="edit" width={11} weight="bold" color="var(--alt-edge)" /> Редактировать
                </button>
              )}
            </div>
            {/* Клиент синхронизировался под своим именем — предлагаем заменить подпись карточки */}
            {client.joinedName && client.joinedName !== client.name && (
              <div className="mt-1.5 rounded-[12px] px-2.5 py-2" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }}>
                <p className="text-[11.5px] font-black leading-tight">При синхронизации клиент указал имя «{client.joinedName}»</p>
                <div className="mt-1.5 flex gap-1.5">
                  <button onClick={() => { tap(); patch.mutate({ name: client.joinedName as string, joinedName: null }); }} className="btn px-3 py-1 text-[11px]">Заменить</button>
                  <button onClick={() => { tap(); patch.mutate({ joinedName: null }); }} className="btn btn-white px-3 py-1 text-[11px]">Оставить своё</button>
                </div>
              </div>
            )}
            {/* Ближайшая встреча — как в разделе «Терапия» */}
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-black" style={{ color: nextAppt ? "var(--ink)" : "var(--muted-2)" }}>
              <Icon name="calendar" width={12} weight="bold" color={nextAppt ? "var(--ink)" : "var(--muted-2)"} />
              {nextAppt ? `Ближайшая запись ${dtf.format(new Date(nextAppt.startsAt))} · ${nextAppt.format === "online" ? "онлайн" : "очно"}` : "встреча пока не назначена"}
            </p>
          </div>
        </div>

        {/* Правка карточки — прямо под шапкой, там же, где её открыли */}
        <Disclosure open={editOpen} autoScroll={false}>
          <ClientEdit client={client} onChanged={inv} onClose={() => setEditOpen(false)} />
        </Disclosure>

        {/* Зачем вообще подключать клиента — и сразу переход к приглашению */}
        {client.link !== "joined" && (
          <button
            onClick={() => { tap(); setConnectOpen(true); setEditOpen(false); setBookOpen(false); }}
            aria-expanded={connectOpen}
            className="mt-3 flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left"
            style={{ background: "var(--alt-soft)", color: "var(--alt-edge)" }}
          >
            <Icon name={client.link === "invited" ? "clock" : "spark"} width={14} weight="bold" color="var(--alt-edge)" />
            <span className="min-w-0 flex-1 text-[11.5px] font-black leading-snug">
              {client.link === "invited"
                ? "Приглашение отправлено — открыть, чтобы отправить ещё раз"
                : "Подключить клиента к платформе, чтобы он мог пользоваться карточкой"}
            </span>
            <ArrowGlyph size={14} className="shrink-0" />
          </button>
        )}

        {/* Приглашение — сразу под строкой, из которой его открыли, и над
            кнопками записи: иначе оно уезжало под календарь. */}
        <Disclosure open={connectOpen}>
          <ClientConnect client={client} onChanged={inv} />
        </Disclosure>

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
                    <p className="inline-flex items-center gap-1.5 text-[13px] font-black">
                      <Icon name="check" width={14} weight="bold" color="var(--green-edge)" />
                      {client.name} {verbEnding(client.name, "записан")}
                    </p>
                    <p className="tnum mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-black text-[var(--ink)]" style={{ background: "var(--green-soft)" }}>
                      <Icon name="calendar" width={12} weight="bold" color="var(--ink)" />
                      <span className="first-letter:uppercase">{dtf.format(new Date(booked.at))}</span> · {booked.format === "online" ? "онлайн" : "очно"}
                    </p>
                    <p className="t-cap mt-1.5">Клиент получит уведомление о смене времени.</p>
                    <button onClick={() => { tap(); setBooked(null); setBookOpen(false); }} className="btn mt-2.5 px-4 py-1.5 text-[11px]">Готово</button>
                  </div>
                ) : (
                  <>
                    <p className="t-micro mb-2">{nextAppt ? "Новое время вместо текущей записи" : "Свободное окно из вашего расписания"}</p>
                    {/* Есть запись — открываемся на её дне, иначе на ближайшем свободном */}
                    <SlotPicker variant="calendar" showAvail startDay={apptDay ?? firstFree} appts={appts} onDayChange={setPickDay} onPick={(iso, format) => ask({
                      title: nextAppt ? "Перенести встречу?" : "Записать на встречу?",
                      when: dtf.format(new Date(iso)),
                      note: nextAppt
                        ? `Текущая запись на ${dtf.format(new Date(nextAppt.startsAt))} освободится, ${client.name} получит уведомление о новом времени.`
                        : `${client.name} увидит встречу в своём расписании и получит напоминание перед началом.`,
                      confirm: nextAppt ? "Перенести" : "Записать",
                      tone: nextAppt ? "accent" : "green",
                      icon: nextAppt ? "swap" : "check",
                      run: () => book.mutate({ iso, format }),
                    })} />
                    <ClientDayTools day={pickDay ?? apptDay ?? firstFree ?? todayY} clientId={client.id} />
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="-mt-8 space-y-4 rounded-t-[27px] bg-white px-4 pb-10 pt-6 @md:px-9">
        {client.demo && (
          <div className="flex items-start gap-2.5 rounded-[16px] px-3.5 py-3" style={{ background: "var(--tiffany-soft)" }}>
            <Icon name="spark" width={16} weight="fill" color="var(--tiffany-edge)" className="mt-0.5 shrink-0" />
            <p className="text-[12.5px] font-black leading-snug">
              Это демо-карточка: так выглядит клиент, с которым уже поработали.
              <span className="block font-semibold text-[var(--muted)]">Место в бесплатном тарифе не занимает — удалите, когда перестанет быть нужной.</span>
            </p>
          </div>
        )}

        <PsychologistHomeworkPreview items={homework} href={`/clients/homework?id=${id}`} />

        {therapy && <TherapistBoardView value={therapy.board} name={client.name} />}

        {therapy && <PsychologistSessionJourney meetings={appts} reflections={therapy.reflections} module={therapy.notesModule} saving={notesModule.isPending} onToggle={() => notesModule.mutateAsync(!therapy.notesModule.psychologistEnabled)} href={`/clients/notes?id=${id}`} />}

        {/* Настроение и колесо баланса — одна миниатюра, раскрывается вниз */}
        <div className="card-soft p-3">
          <button onClick={() => { tap(); setStateOpen((v) => !v); }} className="card-plain flex w-full items-center gap-3 p-3 text-left" aria-expanded={stateOpen}>
            <span className="ico ico-accent h-11 w-11 shrink-0"><Icon name="mood" width={20} weight="bold" /></span>
            <div className="min-w-0 flex-1">
              <p className="t-head">Состояние клиента</p>
              <p className="t-cap mt-1">{moods.length ? `Настроение и колесо баланса · ${moods.length} ${plural(moods.length, "отметка", "отметки", "отметок")}` : "Настроение и колесо баланса"}</p>
              {/* С чем клиент приходит чаще всего — видно до раскрытия: ради
                  этого карточку и открывают, разворачивать за этим не надо */}
              {topMoodEmotions.length > 0 && <div className="mt-2"><EmotionChips items={topMoodEmotions} /></div>}
            </div>
            <span className="shrink-0 text-[13px] font-black text-[var(--muted)]">{stateOpen ? "↑" : "↓"}</span>
          </button>
          <Disclosure open={stateOpen}>
            <div className="mt-2.5 space-y-3">
              {moods.length > 0 && <MoodStats moods={moods} title="Настроение клиента" />}
              <WellbeingCard wheel={therapy?.wheel ?? null} subtitle="самооценка клиента · последние две недели" />
            </div>
          </Disclosure>
        </div>

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
                <MeetingHistory appts={appts} onReschedule={(apptId, iso, format, from) => ask({
                  title: "Перенести встречу?",
                  when: dtf.format(new Date(iso)),
                  note: `Сейчас встреча стоит на ${dtf.format(new Date(from))}. ${client.name} получит уведомление о новом времени.`,
                  confirm: "Перенести",
                  tone: "accent",
                  icon: "swap",
                  run: () => { void updateAppointment(apptId, { startsAt: iso, format }).then(() => { success(); inv(); }); },
                })} />
              )}
            </div>
          </Disclosure>
        </div>

        {/* Заметки */}
        <div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} placeholder="Приватные заметки о работе…" />
          <button onClick={() => { tap(); patch.mutate({ note }); }} className="btn btn-accent mt-2 w-full py-2.5">{patch.isSuccess ? "Сохранено" : "Сохранить"}</button>
        </div>

        <RemoveClient client={client} />

      </main>
      {askNode}
    </div>
  );
}

/**
 * Плитки выбранного дня — те же, что в «Сессиях». Запись этого клиента раскрыта
 * сразу: раньше на её месте была зелёная полоска со статусом, и «Перезаписать»
 * умело только одно — выбрать другое окно. Теперь тут всё меню занятого окна:
 * перенести, освободить, формат, написать. Рядом — плитка «добавить» с тем же
 * контекстным меню, что в неделе: разовое окно открывается, не уходя из карточки.
 */
function ClientDayTools({ day, clientId }: { day: string; clientId: number }) {
  const { daySlots } = useDayWindows();
  const [collapsed, setCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => { setCollapsed(false); setAddOpen(false); }, [day]);

  const cells = daySlots(zoneDay(day)).filter((s) => !s.removed);
  const mine = cells.find((s) => s.appt?.client.id === clientId);

  return (
    <div className="mt-3 grid grid-cols-3 items-start gap-2">
      {mine && (
        <SlotCell
          slot={mine}
          active={!collapsed}
          onTap={() => { tap(); setCollapsed((v) => !v); }}
          onClose={() => setCollapsed(true)}
        />
      )}
      <NewSlotCell
        date={zoneDay(day)}
        taken={cells.map((s) => s.iso)}
        active={addOpen}
        onTap={() => { tap(); setAddOpen((v) => !v); }}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}

/**
 * Правка карточки неподключённого клиента: имя и контакт. Пока человек не вошёл
 * по приглашению, эти поля ведёт психолог — заводил-то он их на слух, и опечатка
 * в имени или в @нике до сих пор чинилась только заведением карточки заново.
 */
function ClientEdit({ client, onChanged, onClose }: { client: Client; onChanged: () => void; onClose: () => void }) {
  const [name, setName] = useState(client.name);
  const [contact, setContact] = useState(client.contact ?? "");
  const save = useMutation({
    mutationFn: () => updateClient(client.id, { name: name.trim(), contact: contact.trim() }),
    onSuccess: () => { success(); onChanged(); onClose(); },
  });
  const dirty = name.trim() !== client.name || contact.trim() !== (client.contact ?? "");

  return (
    <div className="card-plain mt-2.5 space-y-2.5 p-3">
      <label className="block">
        <span className="t-micro">Имя и фамилия</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя и фамилия" autoFocus />
      </label>
      <label className="block">
        <span className="t-micro">Telegram или телефон</span>
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@username или +7 900 000-00-00" />
      </label>
      <div className="flex gap-2">
        <button onClick={() => { tap(); save.mutate(); }} disabled={!name.trim() || !dirty || save.isPending} className="btn btn-accent flex-1 py-2.5 disabled:opacity-50">
          {save.isPending ? "Сохраняем…" : "Сохранить"}
        </button>
        <button onClick={() => { tap(); onClose(); }} className="btn btn-white px-4 py-2.5">Отмена</button>
      </div>
    </div>
  );
}

/**
 * Удаление карточки из списка психолога. Спрашиваем подтверждение и говорим,
 * что именно исчезнет: вместе с карточкой уходят записи, задания и заметки по
 * этому человеку, а вернуть их нельзя. Сам клиент при этом остаётся в
 * приложении со своим аккаунтом — удаляется связь, а не человек.
 */
function RemoveClient({ client }: { client: Client }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteClient(client.id),
    onSuccess: () => {
      success();
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      router.replace("/clients");
    },
  });

  return (
    <div className="pt-2 text-center">
      {confirming ? (
        <div className="card-plain p-3.5 text-left">
          <p className="text-[13px] font-black leading-snug">Удалить {client.name} из вашего списка?</p>
          <p className="t-cap mt-1 leading-snug">Пропадут записи, задания и ваши заметки по этому клиенту. Отменить не получится. У самого клиента приложение и его данные останутся.</p>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => { tap(); remove.mutate(); }}
              disabled={remove.isPending}
              className="btn flex-1 py-2.5 text-[12px] disabled:opacity-60"
              style={{ background: "var(--salmon-edge)", borderColor: "var(--salmon-edge)", color: "#fff" }}
            >
              {remove.isPending ? "Удаляем…" : "Удалить"}
            </button>
            <button onClick={() => { tap(); setConfirming(false); }} className="btn btn-white flex-1 py-2.5 text-[12px]">Отмена</button>
          </div>
          {remove.isError && <p className="mt-2 text-[12px] font-bold" style={{ color: "var(--salmon-edge)" }}>Не получилось удалить. Попробуйте ещё раз.</p>}
        </div>
      ) : (
        <button
          onClick={() => { tap(); setConfirming(true); }}
          className="py-2 text-[13px] font-black"
          style={{ color: "var(--salmon-edge)" }}
        >
          Удалить из вашего списка
        </button>
      )}
    </div>
  );
}

// Панель подключения: приглашение ссылкой. После входа клиента карточка
// синхронизируется автоматически (в демо — через пару секунд).
function ClientConnect({ client, onChanged }: { client: Client; onChanged: () => void }) {
  const link = inviteLink(client);
  const invite = useMutation({ mutationFn: () => inviteClient(client.id), onSuccess: () => { success(); onChanged(); } });
  const [detaching, setDetaching] = useState(false);
  const detach = useMutation({ mutationFn: () => detachClient(client.id), onSuccess: () => { success(); setDetaching(false); onChanged(); } });

  return (
    <div className="card-plain mt-2.5 p-3.5">
      {/* Полей тут нет: приглашение уходит ссылкой, а контакт правится в
          «Редактировать» — два места для одного и того же только путали. */}
      <div>
        {client.link === "joined" ? (
          <>
            <div className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5" style={{ background: "var(--green-soft)", border: "var(--bw) solid var(--green-edge)" }}>
              <Icon name="check" width={18} weight="bold" color="var(--green-edge)" />
              <div><p className="text-[12.5px] font-black leading-tight">Профиль клиента подключён</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">Настроение, задания и записи синхронизируются автоматически.</p></div>
            </div>
            {/* Ссылку пересылают, и по ней может зайти не тот человек. Раньше
                отцепить чужой аккаунт можно было только удалив карточку. */}
            {detaching ? (
              <div className="mt-2.5 rounded-[12px] p-3" style={{ background: "var(--alt-soft)", border: "var(--bw) solid var(--alt-edge)" }}>
                <p className="text-[12.5px] font-black leading-snug">Отвязать аккаунт от карточки?</p>
                <p className="t-cap mt-1 leading-snug">Записи, задания и заметки останутся у вас. Человек перестанет видеть вас в «Терапии», а карточку можно будет подключить заново — новой ссылкой.</p>
                <div className="mt-2.5 flex gap-2">
                  <button onClick={() => { tap(); detach.mutate(); }} disabled={detach.isPending} className="btn flex-1 py-2 text-[12px] disabled:opacity-60">{detach.isPending ? "Отвязываем…" : "Отвязать"}</button>
                  <button onClick={() => { tap(); setDetaching(false); }} className="btn btn-white flex-1 py-2 text-[12px]">Отмена</button>
                </div>
                {detach.isError && <p className="mt-2 text-[12px] font-bold" style={{ color: "var(--salmon-edge)" }}>Не получилось. Попробуйте ещё раз.</p>}
              </div>
            ) : (
              <button onClick={() => { tap(); setDetaching(true); }} className="mt-2 py-1.5 text-[12px] font-black" style={{ color: "var(--muted)" }}>Подключился не тот человек — отвязать</button>
            )}
          </>
        ) : (
          <InviteShare
            link={link}
            // Отправка всегда обновляет отметку приглашения: по ней считается
            // срок жизни ссылки, и просроченную нужно уметь выслать заново.
            onSent={() => invite.mutate()}
            status={client.link === "invited" ? (
              <div className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5" style={{ background: "var(--amber-soft)", border: "var(--bw) solid var(--amber-edge)" }}>
                <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--amber-edge)" }} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "var(--amber-edge)" }} /></span>
                <div className="min-w-0 flex-1"><p className="text-[12.5px] font-black leading-tight">Ждём подключения…</p><p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">{client.invitedAt ? `Отправлено ${dtf.format(new Date(client.invitedAt))}. ` : ""}Когда клиент войдёт по ссылке — карточка обновится сама.</p></div>
              </div>
            ) : (
              <p className="text-[12px] font-semibold text-[var(--muted)]">Отправьте ссылку — клиент откроет приложение, подключит свой профиль, и карточка синхронизируется: настроение, задания, записи.</p>
            )}
          />
        )}
      </div>
    </div>
  );
}

// История встреч постранично: за год работы их набираются десятки, единым
// полотном список перестаёт читаться.
const HISTORY_PAGE = 5;

type Meeting = { id: number; startsAt: string; durationMin: number; status: string; format: "online" | "offline" };

function MeetingHistory({ appts, onReschedule }: { appts: Meeting[]; onReschedule: (id: number, iso: string, format: "online" | "offline", from: string) => void }) {
  const [page, setPage] = useState(0);
  const sorted = [...appts].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const pages = Math.max(1, Math.ceil(sorted.length / HISTORY_PAGE));
  const current = Math.min(page, pages - 1);
  const slice = sorted.slice(current * HISTORY_PAGE, current * HISTORY_PAGE + HISTORY_PAGE);
  return (
    <div className="space-y-2">
      {slice.map((a) => (
        <MeetingRow key={a.id} appt={a} onReschedule={(iso, format) => onReschedule(a.id, iso, format, a.startsAt)} />
      ))}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => { tap(); setPage(current - 1); }} disabled={current === 0} className="rounded-full px-3 py-1.5 text-[12px] font-black disabled:opacity-35" style={{ background: "var(--alt-soft)", color: "var(--ink)" }}>Назад</button>
          <span className="text-[11px] font-black text-[var(--muted)]">{current + 1} / {pages}</span>
          <button onClick={() => { tap(); setPage(current + 1); }} disabled={current >= pages - 1} className="rounded-full px-3 py-1.5 text-[12px] font-black disabled:opacity-35" style={{ background: "var(--alt-soft)", color: "var(--ink)" }}>Дальше</button>
        </div>
      )}
    </div>
  );
}

// Встреча в истории: факт. Запланированную по тапу разворачиваем в перенос.
function MeetingRow({ appt, onReschedule }: { appt: Meeting; onReschedule: (iso: string, format: "online" | "offline") => void }) {
  const [open, setOpen] = useState(false);
  const t = appt.status === "done" ? "green" : appt.status === "scheduled" ? "purple" : "salmon";
  const planned = appt.status === "scheduled";
  return (
    <div className="overflow-hidden rounded-[14px] bg-white" style={{ border: `var(--bw) solid var(--${t}-edge)` }}>
      <button onClick={() => planned && (tap(), setOpen(!open))} className="flex w-full items-center gap-3 p-3 text-left" disabled={!planned}>
        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${t})` }} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-black capitalize">
            <Icon name="calendar" width={13} weight="bold" color="var(--muted)" />
            {dtf.format(new Date(appt.startsAt))}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]">
            <Icon name="clock" width={12} weight="bold" color="var(--muted)" />
            {appt.durationMin} мин · {appt.status === "scheduled" ? "запланирована" : appt.status === "done" ? "проведена" : "отменена"} · {appt.format === "online" ? "онлайн" : "очно"}
          </p>
        </div>
        {planned && <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: "var(--olive-edge)", border: "var(--bw) solid var(--olive-edge)", color: "#fff" }}>{open ? "Свернуть" : "Перенести"}</span>}
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

