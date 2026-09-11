"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ClientAvatar } from "@/components/client-avatar";
import { ClientInviteSheet } from "@/components/client-invite";
import { useConfirmAsk } from "@/components/confirm-ask";
import { ConfirmProPaywall, isNeedsPro } from "@/components/confirm-pro";
import { FmtSwitch } from "@/components/fmt-switch";
import { Icon, type IconName } from "@/components/icons";
import { PickClient, SlotBody, useDayWindows, type Slot } from "@/components/week-windows";
import { awaitsConfirm, confirmAppointment, createAppointment, listAppointments, updateAppointment, type ApptFormat } from "@/lib/appointments";
import { chatLink, listClients } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { getOverrides, getWorkHours, setOverride, type WorkHours } from "@/lib/schedule";
import { addDays, weekdayOf, zoneAt, zoneDay, zoneFormat, zoneYmd } from "@/lib/zone";

const WorkHoursEditor = dynamic(() => import("@/components/work-hours").then((m) => m.WorkHoursEditor), {
  loading: () => <div className="skeleton h-64" />,
});

// Час на сетке — 54 px; перетаскивание магнитит к четверти часа.
const PXM = 0.9;
const HOUR = 60 * PXM;
const SNAP = 15;
const GUT = 46;
const EASE = [0.16, 1, 0.3, 1] as const;
const LINE = "var(--hairline)";
const SUB = "var(--muted)";
const KEYS = ["appointments", "slots", "month-avail", "overrides"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

const timeF = zoneFormat({ hour: "2-digit", minute: "2-digit" });
const dLong = zoneFormat({ weekday: "long", day: "numeric", month: "long" });
const dMonth = zoneFormat({ day: "numeric", month: "long" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const wallMin = (d: Date) => { const [h, m] = timeF.format(d).split(":").map(Number); return (h % 24) * 60 + m; };
const mondayOf = (ymd: string) => addDays(ymd, -weekdayOf(ymd));
const isBusy = (s: Slot) => !!s.appt || !!s.group;
const fmtOf = (s: Slot): ApptFormat => s.appt?.format ?? s.fmt;
const whenOf = (iso: string) => `${cap(dLong.format(new Date(iso)))} в ${timeF.format(new Date(iso))}`;

type Item = { key: string; slot: Slot; ymd: string; start: number; end: number; lane: number; lanes: number };
type Drag = { key: string; ymd: string; start: number; ok: boolean };

// Пересекающиеся окна дня встают рядом, как в Google Календаре.
function layout(list: Omit<Item, "lane" | "lanes">[]): Item[] {
  const out: Item[] = [];
  let cluster: Item[] = [];
  let lanes: number[] = [];
  let clusterEnd = -1;
  const flush = () => { for (const it of cluster) it.lanes = lanes.length; out.push(...cluster); cluster = []; lanes = []; clusterEnd = -1; };
  for (const raw of [...list].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (cluster.length && raw.start >= clusterEnd) flush();
    let lane = lanes.findIndex((e) => e <= raw.start);
    if (lane < 0) { lane = lanes.length; lanes.push(raw.end); } else lanes[lane] = raw.end;
    cluster.push({ ...raw, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, raw.end);
  }
  flush();
  return out;
}

type Paint = { bg: string; edge: string; label: string; note: string; icon: IconName };

function paint(s: Slot): Paint {
  const online = fmtOf(s) === "online";
  const place = online ? "онлайн" : "очно";
  if (s.group) return { bg: "var(--salmon-soft)", edge: "var(--salmon-edge)", label: s.group.title, note: "группа", icon: "users" };
  if (s.appt && s.over) return { bg: "var(--green-soft)", edge: "var(--green-edge)", label: s.appt.client.name, note: "состоялась", icon: "check" };
  if (s.appt && s.past) return { bg: "var(--raspberry)", edge: "var(--raspberry-edge)", label: s.appt.client.name, note: "идёт сейчас", icon: "spark" };
  if (s.appt && awaitsConfirm(s.appt)) return { bg: "var(--amber-soft)", edge: "var(--amber-edge)", label: s.appt.client.name, note: "ждёт подтверждения", icon: "clock" };
  if (s.appt) return { bg: "var(--raspberry-soft)", edge: "var(--raspberry-edge)", label: s.appt.client.name, note: place, icon: online ? "video" : "pin" };
  return { bg: "var(--surface-2)", edge: "transparent", label: "Свободно", note: place, icon: online ? "video" : "pin" };
}

export function WebSessions({ scheduleTail, renderQuickAdd }: { scheduleTail: ReactNode; renderQuickAdd: (open: boolean, close: () => void) => ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const search = useSearchParams();
  const inv = () => { for (const k of KEYS) qc.invalidateQueries({ queryKey: [k] }); };

  // Мини-приложение правит те же записи — подтягиваем изменения сами, без F5.
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments(), refetchInterval: 30_000 });
  useQuery({ queryKey: ["overrides"], queryFn: getOverrides, refetchInterval: 30_000 });
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { daySlots } = useDayWindows();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const todayY = zoneYmd(new Date(now));

  const [weekStart, setWeekStart] = useState(() => mondayOf(zoneYmd()));
  const [open, setOpen] = useState<{ key?: string; appt?: number } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [hover, setHover] = useState<{ ymd: string; min: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<Drag | null>(null);
  const [invite, setInvite] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [needsPro, setNeedsPro] = useState(false);
  const { ask, askNode } = useConfirmAsk();

  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ item: Item; x0: number; y0: number; col: number; moved: boolean } | null>(null);

  useEffect(() => {
    const id = Number(search.get("appointment"));
    const target = id ? appts.find((a) => a.id === id) : null;
    const date = target ? zoneYmd(new Date(target.startsAt)) : search.get("date");
    if (!date) return;
    setWeekStart(mondayOf(date));
    if (target) setOpen({ appt: target.id });
  }, [appts, search]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = days.map((ymd) => layout(
    daySlots(zoneDay(ymd))
      .filter((s) => !s.removed && !(s.past && !isBusy(s)))
      .map((slot) => { const start = wallMin(new Date(slot.iso)); return { key: slot.iso, slot, ymd, start, end: start + slot.dur }; }),
  ));
  const all = byDay.flat();
  const from = Math.max(0, Math.min(work?.dayFrom ?? 9, ...all.map((i) => Math.floor(i.start / 60))));
  const to = Math.min(24, Math.max(work?.dayTo ?? 21, ...all.map((i) => Math.ceil(i.end / 60))));
  const height = (to - from) * HOUR;

  const openItem = open ? all.find((i) => (open.key ? i.key === open.key : i.slot.appt?.id === open.appt)) ?? null : null;

  // Первый заход — сетка прокручена к текущему часу, а не к началу дня.
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !scrollRef.current || !work) return;
    scrolled.current = true;
    scrollRef.current.scrollTop = Math.max(0, (wallMin(new Date()) / 60 - from - 1) * HOUR);
  }, [work, from]);

  const goWeek = (ymd: string) => { select(); setWeekStart(mondayOf(ymd)); };

  /* ——— мутации: те же вызовы, что у плиток в мини-приложении ——— */
  const moveAppt = useMutation({
    mutationFn: ({ id, iso }: { id: number; iso: string }) => updateAppointment(id, { startsAt: iso }),
    onSuccess: () => { success(); inv(); },
    onSettled: () => setPending(null),
  });
  const moveWin = useMutation({
    mutationFn: async ({ fromIso, toIso, dur, fmt }: { fromIso: string; toIso: string; dur: number; fmt: ApptFormat }) => {
      await setOverride(fromIso, { removed: true });
      await setOverride(toIso, { added: true, removed: false, dur, fmt });
    },
    onSuccess: () => { select(); inv(); },
    onSettled: () => setPending(null),
  });
  const toggleFmt = useMutation({
    mutationFn: async (s: Slot) => {
      const next: ApptFormat = fmtOf(s) === "online" ? "offline" : "online";
      if (s.appt) await updateAppointment(s.appt.id, { format: next });
      else await setOverride(s.iso, { fmt: next });
    },
    onSuccess: () => { select(); inv(); },
  });
  const cancel = useMutation({ mutationFn: (id: number) => updateAppointment(id, { status: "cancelled" }), onSuccess: inv });
  const removeWin = useMutation({ mutationFn: (iso: string) => setOverride(iso, { removed: true }), onSuccess: inv });
  const confirm = useMutation({
    mutationFn: (id: number) => confirmAppointment(id),
    onSuccess: () => { success(); inv(); },
    onError: (e) => { if (isNeedsPro(e)) setNeedsPro(true); },
  });

  const askCancel = (s: Slot) => ask({
    title: "Освободить окно?",
    when: whenOf(s.iso),
    note: `Запись ${s.appt!.client.name} будет отменена, а окно снова станет свободным. Клиент получит уведомление.`,
    confirm: "Освободить", tone: "danger", icon: "close",
    run: () => cancel.mutate(s.appt!.id),
  });
  const askRemove = (s: Slot) => ask({
    title: "Удалить окно?",
    when: whenOf(s.iso),
    note: "Окно пропадёт из расписания — клиенты больше не смогут записаться на это время.",
    confirm: "Удалить", tone: "danger", icon: "close",
    run: () => removeWin.mutate(s.iso),
  });
  const askConfirm = (s: Slot) => ask({
    title: "Подтвердить встречу?",
    when: whenOf(s.iso),
    note: `${s.appt!.client.name} получит уведомление, что встреча в силе.`,
    confirm: "Подтвердить", tone: "green", icon: "check",
    run: () => confirm.mutate(s.appt!.id),
  });

  /* ——— перетаскивание ——— */
  const canDrag = (it: Item) => !it.slot.group && !it.slot.past;

  const targetOf = (it: Item, dx: number, dy: number, col: number): Drag => {
    const ni = Math.min(6, Math.max(0, days.indexOf(it.ymd) + Math.round(dx / col)));
    const ymd = days[ni];
    const dur = it.end - it.start;
    const start = Math.min(to * 60 - dur, Math.max(from * 60, it.start + Math.round(dy / PXM / SNAP) * SNAP));
    const at = zoneAt(ymd, Math.floor(start / 60), start % 60)?.getTime() ?? 0;
    // Запись можно положить поверх свободного окна — она его и займёт. Окно
    // само по себе на чужое время не ложится.
    const clash = byDay[ni].some((o) => o.key !== it.key && (it.slot.appt ? isBusy(o.slot) : true) && o.start < start + dur && start < o.end);
    return { key: it.key, ymd, start, ok: at > Date.now() && !clash };
  };

  const commit = (it: Item, t: Drag) => {
    const toIso = zoneAt(t.ymd, Math.floor(t.start / 60), t.start % 60)!.toISOString();
    setPending(t);
    if (it.slot.appt) {
      const appt = it.slot.appt;
      ask({
        title: "Перенести встречу?",
        when: whenOf(toIso),
        note: `Сейчас встреча стоит на ${whenOf(it.slot.iso).toLowerCase()}. ${appt.client.name} получит уведомление о новом времени.`,
        confirm: "Перенести", tone: "accent", icon: "swap",
        run: () => moveAppt.mutate({ id: appt.id, iso: toIso }),
        onCancel: () => setPending(null),
      });
    } else {
      moveWin.mutate({ fromIso: it.slot.iso, toIso, dur: it.slot.dur, fmt: it.slot.fmt });
    }
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>, it: Item) => {
    if (e.button !== 0 || !gridRef.current) return;
    dragRef.current = { item: it, x0: e.clientX, y0: e.clientY, col: gridRef.current.getBoundingClientRect().width / 7, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5 || !canDrag(d.item)) return;
      d.moved = true;
      setHover(null);
    }
    setDrag(targetOf(d.item, dx, dy, d.col));
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) {
      tap();
      if (d.item.slot.group) router.push(`/groups/?id=${d.item.slot.group.groupId}`);
      else setOpen({ key: d.item.key });
      return;
    }
    const t = targetOf(d.item, e.clientX - d.x0, e.clientY - d.y0, d.col);
    if (t.ok && (t.ymd !== d.item.ymd || t.start !== d.item.start)) commit(d.item, t);
  };
  const onCancelPtr = () => { dragRef.current = null; setDrag(null); };

  /* ——— клик по пустой сетке: новая сессия ——— */
  const minAt = (e: RMouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    return Math.min(to * 60 - 30, from * 60 + Math.floor(y / PXM / 30) * 30);
  };
  const futureAt = (ymd: string, min: number) => (zoneAt(ymd, Math.floor(min / 60), min % 60)?.getTime() ?? 0) > now;

  const quickFor = (it: Item): ReactNode => {
    const s = it.slot;
    if (s.group) return null;
    if (s.appt) {
      const c = clients.find((x) => x.id === s.appt!.client.id);
      const link = c ? chatLink(c) : null;
      return (
        <>
          {!s.over && awaitsConfirm(s.appt) && <QBtn icon="check" label="Подтвердить" color="var(--green-edge)" onClick={() => askConfirm(s)} />}
          {!s.past && <QBtn icon={fmtOf(s) === "online" ? "video" : "pin"} label={fmtOf(s) === "online" ? "Сделать очной" : "Сделать онлайн"} onClick={() => toggleFmt.mutate(s)} />}
          <QBtn icon="telegram" label="Написать" href={link ?? `/clients/${s.appt.client.id}`} external={!!link} />
          {!s.past && <QBtn icon="close" label="Освободить" color="var(--danger)" onClick={() => askCancel(s)} />}
        </>
      );
    }
    return (
      <>
        <QBtn icon="plus" label="Записать клиента" onClick={() => setOpen({ key: it.key })} />
        <QBtn icon={s.fmt === "online" ? "video" : "pin"} label={s.fmt === "online" ? "Сделать очным" : "Сделать онлайн"} onClick={() => toggleFmt.mutate(s)} />
        <QBtn icon="close" label="Удалить окно" color="var(--danger)" onClick={() => askRemove(s)} />
      </>
    );
  };

  const rangeLabel = `${dMonth.format(zoneDay(days[0]))} — ${dMonth.format(zoneDay(days[6]))} ${days[6].slice(0, 4)}`;
  const dragged = drag ? all.find((i) => i.key === drag.key) : pending ? all.find((i) => i.key === pending.key) : undefined;
  const shown = drag ?? pending;
  const nowMin = wallMin(new Date(now));

  const dayStats = (ymd: string) => {
    const list = daySlots(zoneDay(ymd)).filter((s) => !s.removed);
    return { busy: list.filter(isBusy).length, free: list.filter((s) => !isBusy(s) && !s.past).length };
  };

  return (
    <div data-wide className="pb-4">
      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="mr-auto">
          <h1 className="text-[28px] font-[650] leading-none tracking-tight">Сессии</h1>
          <p className="mt-1.5 text-[12px] font-semibold" style={{ color: SUB }}>{cap(rangeLabel)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => goWeek(todayY)} className="h-8 rounded-full px-3.5 text-[12px] font-bold" style={{ background: "var(--surface-2)" }}>Сегодня</button>
          <NavArrow dir="left" onClick={() => goWeek(addDays(weekStart, -7))} />
          <NavArrow dir="right" onClick={() => goWeek(addDays(weekStart, 7))} />
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { tap(); setInvite(true); }} className="flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold" style={{ background: "var(--tiffany-soft)", color: "var(--tiffany-edge)" }}>
            <Icon name="share" width={13} weight="fill" color="var(--tiffany-edge)" /> Пригласить
          </button>
          <button onClick={() => { tap(); setQuickAdd(true); }} className="flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold text-white" style={{ background: "var(--ink)" }}>
            <Icon name="plus" width={13} weight="bold" color="#fff" /> Запись
          </button>
        </div>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_252px]">
        <div className="overflow-x-auto rounded-[18px]" style={{ background: "var(--surface)", border: `1px solid ${LINE}` }}>
          <div className="min-w-[640px]">
            <div className="grid" style={{ gridTemplateColumns: `${GUT}px repeat(7, minmax(0, 1fr))`, borderBottom: `1px solid ${LINE}` }}>
              <span />
              {days.map((ymd, i) => {
                const today = ymd === todayY;
                return (
                  <div key={ymd} className="flex flex-col items-center gap-1 py-2.5" style={{ borderLeft: `1px solid ${LINE}` }}>
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: today ? "var(--raspberry-edge)" : SUB }}>{WD[i]}</span>
                    <span className="tnum flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-black" style={today ? { background: "var(--ink)", color: "#fff" } : { opacity: ymd < todayY ? 0.45 : 1 }}>
                      {Number(ymd.slice(8))}
                    </span>
                  </div>
                );
              })}
            </div>

            <div ref={scrollRef} className="max-h-[calc(100dvh-196px)] min-h-[420px] overflow-y-auto">
              <div className="relative grid" style={{ gridTemplateColumns: `${GUT}px minmax(0, 1fr)`, height }}>
                <div className="relative">
                  {Array.from({ length: to - from }, (_, i) => from + i).filter((h) => h > from).map((h) => (
                    <span key={h} className="tnum absolute right-2 -translate-y-1/2 text-[9.5px] font-semibold" style={{ top: (h - from) * HOUR, color: SUB }}>{h}:00</span>
                  ))}
                </div>
                <div
                  ref={gridRef}
                  className="relative grid grid-cols-7"
                  style={{
                    backgroundImage: `repeating-linear-gradient(to bottom, ${LINE} 0 1px, transparent 1px ${HOUR / 2}px, rgba(32,28,24,.045) ${HOUR / 2}px ${HOUR / 2 + 1}px, transparent ${HOUR / 2 + 1}px ${HOUR}px)`,
                  }}
                >
                  {days.map((ymd, di) => {
                    const past = ymd < todayY;
                    const today = ymd === todayY;
                    const shade = past ? height : today ? Math.max(0, Math.min(height, (nowMin - from * 60) * PXM)) : 0;
                    return (
                      <div
                        key={ymd}
                        className="relative"
                        style={{ borderLeft: `1px solid ${LINE}`, cursor: "cell" }}
                        onMouseMove={(e) => { if (drag || e.target !== e.currentTarget) { if (hover) setHover(null); return; } const min = minAt(e); if (hover?.ymd !== ymd || hover.min !== min) setHover(futureAt(ymd, min) ? { ymd, min } : null); }}
                        onMouseLeave={() => setHover(null)}
                        onClick={(e) => {
                          if (e.target !== e.currentTarget) return;
                          const min = minAt(e);
                          if (!futureAt(ymd, min)) return;
                          tap();
                          setDraft(zoneAt(ymd, Math.floor(min / 60), min % 60)!.toISOString());
                        }}
                      >
                        {shade > 0 && <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: shade, background: "rgba(32,28,24,.028)" }} />}
                        {hover?.ymd === ymd && (
                          <div className="pointer-events-none absolute inset-x-1 flex items-start rounded-[8px] px-1.5 py-1 text-[10px] font-bold" style={{ top: (hover.min - from * 60) * PXM + 1, height: 30 * PXM - 2, border: `1px dashed ${"var(--muted-2)"}`, color: SUB }}>
                            + {hm(hover.min)}
                          </div>
                        )}
                        {byDay[di].map((it) => (
                          <BlockView
                            key={it.key}
                            it={it}
                            start={it.start}
                            from={from}
                            state={shown?.key === it.key ? "origin" : undefined}
                            draggable={canDrag(it)}
                            quick={quickFor(it)}
                            onPointerDown={(e) => onDown(e, it)}
                            onPointerMove={onMove}
                            onPointerUp={onUp}
                            onPointerCancel={onCancelPtr}
                          />
                        ))}
                        {shown && dragged && shown.ymd === ymd && (
                          <BlockView it={{ ...dragged, lane: 0, lanes: 1 }} start={shown.start} from={from} state={shown.ok ? "ghost" : "bad"} />
                        )}
                        {today && nowMin >= from * 60 && nowMin <= to * 60 && (
                          <div className="pointer-events-none absolute inset-x-0 z-[3]" style={{ top: (nowMin - from * 60) * PXM }}>
                            <div className="h-[2px] w-full" style={{ background: "var(--raspberry-edge)" }} />
                            <span className="absolute -left-[5px] -top-[4px] h-[10px] w-[10px] rounded-full" style={{ background: "var(--raspberry-edge)" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-2.5">
          <MonthMini weekStart={weekStart} todayY={todayY} onPick={goWeek} stats={dayStats} />
          <ScheduleMini work={work} onOpen={() => { tap(); setScheduleOpen(true); }} />
        </aside>
      </div>

      <AnimatePresence>
        {openItem && <SlotPop key={openItem.key} slot={openItem.slot} onClose={() => setOpen(null)} />}
        {draft && <NewPop key={draft} iso={draft} defaultDur={work?.sessionMinutes ?? 50} onClose={() => setDraft(null)} />}
        {scheduleOpen && (
          <Pop key="schedule" wide onClose={() => setScheduleOpen(false)}>
            <PopHead title="График" sub="Рабочие часы недели" onClose={() => setScheduleOpen(false)} />
            <WorkHoursEditor onSaved={() => setScheduleOpen(false)} tail={scheduleTail} />
          </Pop>
        )}
        {invite && <ClientInviteSheet onClose={() => setInvite(false)} start="schedule" />}
      </AnimatePresence>
      {renderQuickAdd(quickAdd, () => setQuickAdd(false))}
      <ConfirmProPaywall open={needsPro} onClose={() => setNeedsPro(false)} />
      {askNode}
    </div>
  );
}

/* ——— Блок на сетке ——— */

function BlockView({
  it, start, from, state, draggable = false, quick, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
}: {
  it: Item;
  start: number;
  from: number;
  state?: "origin" | "ghost" | "bad";
  draggable?: boolean;
  quick?: ReactNode;
  onPointerDown?: (e: RPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: RPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: RPointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: () => void;
}) {
  const s = it.slot;
  const p = paint(s);
  const dur = it.end - it.start;
  const h = Math.max(dur * PXM - 2, 16);
  const tall = h >= 50;
  const short = h < 34;
  const free = !isBusy(s);
  const floating = state === "ghost" || state === "bad";

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={`group absolute select-none overflow-hidden rounded-[8px] ${floating ? "pointer-events-none" : ""}`}
      style={{
        top: (start - from * 60) * PXM + 1,
        height: h,
        left: `calc(${(it.lane / it.lanes) * 100}% + 3px)`,
        width: `calc(${100 / it.lanes}% - 6px)`,
        background: state === "bad" ? "transparent" : p.bg,
        border: state === "bad" ? "1px dashed var(--danger)" : free ? `1px dashed ${"var(--muted-2)"}` : "none",
        opacity: state === "origin" ? 0.35 : state === "ghost" ? 0.92 : 1,
        cursor: draggable ? "grab" : "pointer",
        zIndex: floating ? 4 : 1,
        touchAction: "none",
      }}
    >
      {!free && <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: p.edge }} />}
      <div className={`flex h-full min-w-0 ${short ? "items-center gap-1 px-2" : "flex-col gap-0.5 px-2 py-1"}`}>
        {short ? (
          <p className="min-w-0 truncate text-[10.5px] font-bold leading-none">
            <span className="tnum" style={{ color: SUB }}>{hm(start)}</span> <span className={free ? "" : "font-black"} style={{ color: free ? SUB : "var(--ink)" }}>{p.label}</span>
          </p>
        ) : (
          <>
            <p className="tnum flex items-center gap-1 text-[10px] font-bold leading-none" style={{ color: SUB }}>
              {hm(start)}–{hm(start + dur)}
            </p>
            <p className="flex min-w-0 items-center gap-1.5">
              {s.appt && tall && (
                <ClientAvatar name={s.appt.client.name} photo={s.appt.client.photo} className="h-[18px] w-[18px] shrink-0 rounded-[6px] text-[9px] font-black leading-none" style={{ background: "#fff" }} />
              )}
              <span className="min-w-0 truncate text-[11.5px] font-black leading-tight" style={{ color: free ? SUB : "var(--ink)" }}>{p.label}</span>
            </p>
            {tall && (
              <p className="flex min-w-0 items-center gap-1 text-[9.5px] font-semibold leading-none" style={{ color: SUB }}>
                <Icon name={p.icon} width={10} weight="bold" color={SUB} />
                <span className="truncate">{p.note}</span>
              </p>
            )}
          </>
        )}
      </div>
      {quick && !state && (
        <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">{quick}</div>
      )}
    </div>
  );
}

function QBtn({ icon, label, onClick, href, external, color = "var(--ink)" }: { icon: IconName; label: string; onClick?: () => void; href?: string; external?: boolean; color?: string }) {
  const cls = "flex h-[20px] w-[20px] items-center justify-center rounded-full bg-white";
  const stop = (e: RPointerEvent) => e.stopPropagation();
  if (href) {
    return (
      <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} onPointerDown={stop} onClick={(e) => e.stopPropagation()} className={cls} title={label} aria-label={label}>
        <Icon name={icon} width={11} weight="bold" color={color} />
      </a>
    );
  }
  return (
    <button onPointerDown={stop} onClick={(e) => { e.stopPropagation(); tap(); onClick?.(); }} className={cls} title={label} aria-label={label}>
      <Icon name={icon} width={11} weight="bold" color={color} />
    </button>
  );
}

function NavArrow({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--surface-2)" }} aria-label={dir === "left" ? "Прошлая неделя" : "Следующая неделя"}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

/* ——— Правая колонка ——— */

function MonthMini({ weekStart, todayY, onPick, stats }: { weekStart: string; todayY: string; onPick: (ymd: string) => void; stats: (ymd: string) => { busy: number; free: number } }) {
  const [month, setMonth] = useState(() => addDays(weekStart, 3).slice(0, 7));
  useEffect(() => { setMonth(addDays(weekStart, 3).slice(0, 7)); }, [weekStart]);
  const [y, m] = month.split("-").map(Number);
  const shift = (d: number) => { const t = new Date(Date.UTC(y, m - 1 + d, 1)); setMonth(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`); };
  const start = mondayOf(`${month}-01`);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const rows = cells[35].slice(0, 7) === month ? 6 : 5;
  const weekEnd = addDays(weekStart, 6);

  return (
    <section className="rounded-[18px] p-3.5" style={{ background: "var(--surface)", border: `1px solid ${LINE}` }}>
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-black">{MONTHS[m - 1]} <span style={{ color: SUB }}>{y}</span></h2>
        <span className="flex gap-1">
          <MiniArrow dir="left" onClick={() => shift(-1)} />
          <MiniArrow dir="right" onClick={() => shift(1)} />
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-7 gap-y-0.5 text-center">
        {WD.map((d) => <span key={d} className="pb-1 text-[8px] font-bold uppercase tracking-[0.1em]" style={{ color: SUB }}>{d}</span>)}
        {cells.slice(0, rows * 7).map((ymd, i) => {
          const inMonth = ymd.slice(0, 7) === month;
          const inWeek = ymd >= weekStart && ymd <= weekEnd;
          const today = ymd === todayY;
          const { busy, free } = stats(ymd);
          const col = i % 7;
          return (
            <button
              key={ymd}
              onClick={() => onPick(ymd)}
              className="flex h-[36px] flex-col items-center justify-start gap-[3px] pt-[3px]"
              style={{
                background: inWeek ? "var(--raspberry-soft)" : "transparent",
                borderRadius: inWeek ? (col === 0 ? "9px 0 0 9px" : col === 6 ? "0 9px 9px 0" : 0) : 9,
                opacity: inMonth ? (ymd < todayY ? 0.55 : 1) : 0.3,
              }}
            >
              <span className="tnum flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold" style={today ? { background: "var(--ink)", color: "#fff" } : undefined}>
                {Number(ymd.slice(8))}
              </span>
              <span className="flex h-[4px] items-center gap-[2px]">
                {Array.from({ length: Math.min(busy, 3) }, (_, k) => <span key={`b${k}`} className="h-[4px] w-[4px] rounded-full" style={{ background: "var(--raspberry-edge)" }} />)}
                {Array.from({ length: Math.min(free, 3 - Math.min(busy, 3)) }, (_, k) => <span key={`f${k}`} className="h-[4px] w-[4px] rounded-full" style={{ border: "1px solid var(--muted-2)" }} />)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[9px] font-semibold" style={{ color: SUB }}>
        <span className="flex items-center gap-1"><span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--raspberry-edge)" }} />сессии</span>
        <span className="flex items-center gap-1"><span className="h-[5px] w-[5px] rounded-full" style={{ border: "1px solid var(--muted-2)" }} />свободные окна</span>
      </div>
    </section>
  );
}

function MiniArrow({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-5 w-5 items-center justify-center rounded-full" style={{ border: `1px solid ${LINE}` }} aria-label={dir === "left" ? "Прошлый месяц" : "Следующий месяц"}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

// График в миниатюре: неделя столбиками, окна полосками. Раскрывается в редактор.
function ScheduleMini({ work, onOpen }: { work?: WorkHours; onOpen: () => void }) {
  const from = work?.dayFrom ?? 9;
  const to = Math.max(from + 1, work?.dayTo ?? 21);
  const span = (to - from) * 60;
  const slots = Object.values(work?.hours ?? {}).flat();
  const empty = slots.length === 0;
  const hours = Math.round(slots.reduce((sum, s) => sum + s.d, 0) / 60);

  return (
    <button onClick={onOpen} className="group block w-full rounded-[18px] p-3.5 text-left" style={{ background: "var(--surface)", border: `1px solid ${LINE}` }}>
      <div className="flex items-center gap-2">
        <h2 className="mr-auto text-[13px] font-black">График</h2>
        {empty
          ? <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase leading-none tracking-wide text-white" style={{ background: "var(--danger)" }}>не задан</span>
          : <span className="tnum text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: SUB }}>{slots.length} окон · {hours} ч</span>}
        <Icon name="edit" width={13} weight="bold" color={SUB} />
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {WD.map((w, d) => (
          <div key={w} className="flex flex-col items-center gap-1">
            <div className="relative h-[78px] w-full overflow-hidden rounded-[6px]" style={{ background: "var(--surface-2)" }}>
              {(work?.hours?.[d] ?? []).map((s) => {
                const [hh, mm] = s.t.split(":").map(Number);
                const top = ((hh * 60 + mm - from * 60) / span) * 100;
                return (
                  <span
                    key={s.t}
                    className="absolute inset-x-[3px] rounded-[3px]"
                    style={{ top: `${top}%`, height: `${Math.max((s.d / span) * 100, 3)}%`, background: s.fmt === "online" ? "var(--tiffany)" : "var(--raspberry)" }}
                  />
                );
              })}
            </div>
            <span className="text-[8px] font-bold uppercase tracking-[0.08em]" style={{ color: SUB }}>{w}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[9px] font-semibold" style={{ color: SUB }}>
        <span className="flex items-center gap-1"><span className="h-[5px] w-[9px] rounded-[2px]" style={{ background: "var(--tiffany)" }} />онлайн</span>
        <span className="flex items-center gap-1"><span className="h-[5px] w-[9px] rounded-[2px]" style={{ background: "var(--raspberry)" }} />очно</span>
        <span className="tnum ml-auto">{from}:00–{to}:00</span>
      </div>
    </button>
  );
}

/* ——— Всплывающие окна ——— */

function Pop({ onClose, children, wide = false }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(17,17,17,.3)" }}
    >
      <motion.section
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[88dvh] w-full overflow-y-auto rounded-[18px] p-4 ${wide ? "max-w-[760px]" : "max-w-[420px]"}`}
        style={{ background: "var(--surface)", border: `1px solid ${LINE}` }}
      >
        {children}
      </motion.section>
    </motion.div>,
    document.body,
  );
}

function PopHead({ title, sub, dot, onClose }: { title: string; sub?: string; dot?: string; onClose: () => void }) {
  return (
    <div className="mb-3.5 flex items-start gap-2.5">
      {dot && <span className="mt-[5px] h-3 w-3 shrink-0 rounded-[4px]" style={{ background: dot }} />}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-black leading-tight">{title}</p>
        {sub && <p className="tnum mt-1 text-[12px] font-semibold" style={{ color: SUB }}>{sub}</p>}
      </div>
      <button onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--surface-2)" }} aria-label="Закрыть">
        <Icon name="close" width={13} weight="bold" color="var(--ink)" />
      </button>
    </div>
  );
}

function SlotPop({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const end = new Date(new Date(slot.iso).getTime() + slot.dur * 60_000);
  const p = paint(slot);
  return (
    <Pop onClose={onClose}>
      <PopHead
        title={cap(dLong.format(new Date(slot.iso)))}
        sub={`${slot.t}–${timeF.format(end)} · ${slot.dur} мин`}
        dot={isBusy(slot) ? p.edge : "var(--muted-2)"}
        onClose={onClose}
      />
      <SlotBody slot={slot} onClose={onClose} />
    </Pop>
  );
}

function NewPop({ iso, defaultDur, onClose }: { iso: string; defaultDur: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [dur, setDur] = useState(defaultDur);
  const [fmt, setFmt] = useState<ApptFormat>("online");
  const { ask, askNode } = useConfirmAsk();
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const done = () => { success(); onClose(); for (const k of KEYS) qc.invalidateQueries({ queryKey: [k] }); };
  const openWindow = useMutation({ mutationFn: () => setOverride(iso, { added: true, removed: false, dur, fmt }), onSuccess: done });
  const book = useMutation({ mutationFn: (clientId: number) => createAppointment({ clientId, startsAt: iso, format: fmt, durationMin: dur }), onSuccess: done });
  const at = new Date(iso);
  const endT = timeF.format(new Date(at.getTime() + dur * 60_000));

  return (
    <Pop onClose={onClose}>
      <PopHead title="Новая сессия" sub={`${cap(dLong.format(at))} · ${timeF.format(at)}–${endT}`} onClose={onClose} />
      <div className="space-y-3">
        <label className="flex items-center gap-2.5">
          <span className="t-micro shrink-0">Длительность</span>
          <input type="range" min={30} max={120} step={5} value={dur} onChange={(e) => { select(); setDur(Number(e.target.value)); }} className="min-w-0 flex-1 cursor-pointer" style={{ accentColor: "var(--ink)" }} />
          <span className="tnum w-[52px] shrink-0 text-right text-[12px] font-black">{dur} мин</span>
        </label>
        <div className="flex items-center justify-between">
          <span className="t-micro">Формат</span>
          <FmtSwitch fmt={fmt} onToggle={() => { select(); setFmt(fmt === "online" ? "offline" : "online"); }} />
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <PickClient onPick={(id) => ask({
            title: "Записать на встречу?",
            when: `${whenOf(iso)} · ${dur} мин`,
            note: `${clients.find((c) => c.id === id)?.name ?? "Клиент"} увидит встречу в своём расписании и получит напоминание перед началом.`,
            confirm: "Записать", tone: "green", icon: "check",
            run: () => book.mutate(id),
          })} />
          <button onClick={() => { tap(); openWindow.mutate(); }} disabled={openWindow.isPending} className="shrink-0 text-[12px] font-black disabled:opacity-50" style={{ color: "var(--olive-edge)" }}>
            {openWindow.isPending ? "Открываем…" : "Оставить свободным окном"}
          </button>
        </div>
      </div>
      {askNode}
    </Pop>
  );
}
