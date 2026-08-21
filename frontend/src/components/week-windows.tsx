"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ClientAvatar } from "@/components/client-avatar";
import { ConfirmActions } from "@/components/confirm-actions";
import { useConfirmAsk } from "@/components/confirm-ask";
import { ConfirmDone } from "@/components/confirm-done";
import { ConfirmProPaywall, isNeedsPro } from "@/components/confirm-pro";
import { ClientPicker } from "@/components/day-slots";
import { FmtSwitch } from "@/components/fmt-switch";
import { Icon } from "@/components/icons";
import { SlotPicker } from "@/components/slot-picker";
import { awaitsConfirm, confirmAppointment, createAppointment, listAppointments, updateAppointment, type Appointment, type ApptFormat } from "@/lib/appointments";
import { chatLink, createClient, listClients } from "@/lib/clients";
import { activeMembers, listGroups, type GroupKind, type GroupMember } from "@/lib/groups";
import { GROUPS_LIVE } from "@/lib/modules";
import { select, success, tap } from "@/lib/haptics";
import { getOverrides, getWorkHours, setOverride, ymdLocal } from "@/lib/schedule";
import { addDays, weekdayOf, zoneAt, zoneDay, zoneFormat, zoneHour, sameZoneDay } from "@/lib/zone";

const timeF = zoneFormat({ hour: "2-digit", minute: "2-digit" });
const dLong = zoneFormat({ weekday: "long", day: "numeric", month: "long" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pl = (n: number, one: string, few: string, many: string) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };

/** Встреча группы в календаре: занимает окно целиком, тап ведёт в карточку. */
export type GroupSlot = { groupId: number; meetingId: number; title: string; kind: GroupKind; members: GroupMember[]; done: boolean; marked: boolean };

export type Slot = { iso: string; hour: number; t: string; dur: number; fmt: ApptFormat; past: boolean; appt?: Appointment; group?: GroupSlot; removed: boolean };

// Окна дня собираются из графика + записей и встреч групп, которые в график не попали.
export function useDayWindows() {
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: overrides = {} } = useQuery({ queryKey: ["overrides"], queryFn: getOverrides });
  // Модуль закрыт — в календаре групп нет, и роут ответил бы 402.
  const { data: groups = [] } = useQuery({ queryKey: ["groups"], queryFn: listGroups, enabled: GROUPS_LIVE });

  // Все живые встречи всех активных групп, разложенные по времени начала.
  const meetings = useMemo(() => {
    const out = new Map<number, GroupSlot & { startsAt: string; durationMin: number }>();
    for (const g of groups) {
      if (g.status !== "active") continue;
      for (const m of g.meetings) {
        if (m.status === "cancelled") continue;
        out.set(new Date(m.startsAt).getTime(), {
          groupId: g.id, meetingId: m.id, title: g.title, kind: g.kind,
          members: activeMembers(g), done: m.status === "done", marked: m.attendance.length > 0,
          startsAt: m.startsAt, durationMin: m.durationMin,
        });
      }
    }
    return out;
  }, [groups]);

  const daySlots = (d: Date): Slot[] => {
    const ymd = ymdLocal(d);
    const wd = weekdayOf(ymd);
    const now = Date.now();
    const schedule: Slot[] = [...(work?.hours?.[wd] ?? [])].sort((a, b) => a.t.localeCompare(b.t)).map((s) => {
      const [hh, mm] = s.t.split(":").map(Number);
      const dt = zoneAt(ymd, hh, mm) ?? new Date(NaN);
      const iso = dt.toISOString(); const ov = overrides[iso];
      const appt = appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime());
      const grp = meetings.get(dt.getTime());
      return { iso, hour: hh, t: s.t, dur: grp?.durationMin ?? appt?.durationMin ?? s.d, fmt: (ov?.fmt ?? s.fmt) as ApptFormat, past: dt.getTime() < now, appt, group: grp, removed: !!ov?.removed };
    });
    // Разовые окна: открыты на конкретную дату, в шаблоне недели их нет.
    const extra: Slot[] = Object.entries(overrides)
      .filter(([iso, ov]) => ov?.added && !ov.removed && sameZoneDay(new Date(iso), d) && !schedule.some((s) => s.iso === iso))
      .map(([iso, ov]) => {
        const dt = new Date(iso);
        const appt = appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime());
        return { iso, hour: zoneHour(dt), t: timeF.format(dt), dur: appt?.durationMin ?? ov?.dur ?? work?.sessionMinutes ?? 50, fmt: (ov?.fmt ?? "online") as ApptFormat, past: dt.getTime() < Date.now(), appt, removed: false };
      });
    const apptOnly: Slot[] = appts
      .filter((a) => a.status !== "cancelled" && sameZoneDay(new Date(a.startsAt), d)
        && !schedule.some((s) => new Date(s.iso).getTime() === new Date(a.startsAt).getTime())
        && !extra.some((s) => new Date(s.iso).getTime() === new Date(a.startsAt).getTime()))
      .map((a) => { const dt = new Date(a.startsAt); return { iso: a.startsAt, hour: zoneHour(dt), t: timeF.format(dt), dur: a.durationMin, fmt: a.format, past: dt.getTime() < now, appt: a, removed: false }; });
    // Встреча группы поставлена вне шаблона недели — в дне она всё равно видна:
    // окно занято, и специалист должен об этом узнать из календаря, а не из модуля.
    const taken = new Set([...schedule, ...extra, ...apptOnly].map((s) => new Date(s.iso).getTime()));
    const groupOnly: Slot[] = [...meetings.values()]
      .filter((m) => sameZoneDay(new Date(m.startsAt), d) && !taken.has(new Date(m.startsAt).getTime()))
      .map((m) => { const dt = new Date(m.startsAt); return { iso: m.startsAt, hour: zoneHour(dt), t: timeF.format(dt), dur: m.durationMin, fmt: "offline" as ApptFormat, past: dt.getTime() < now, group: m, removed: false }; });
    return [...schedule, ...extra, ...apptOnly, ...groupOnly].sort((a, b) => a.iso.localeCompare(b.iso));
  };

  const hasWork = Object.values(work?.hours ?? {}).some((a) => (a ?? []).length > 0);
  return { daySlots, hasWork };
}

export function NoWorkHours() {
  return (
    <div className="rounded-[13px] py-6 text-center text-[13px] font-semibold text-[var(--muted)]" style={{ background: "#fff" }}>
      Окна ещё не заданы.<br /><Link href="/cabinet" className="font-extrabold underline">Настроить график в кабинете</Link>
    </div>
  );
}

// Агенда одного дня. Тап по окну не открывает меню снизу — само окно
// разворачивается в широкий блок и сворачивается обратно.
export function DayAgenda({ date, today, busyOnly = false, badge }: { date: Date; today?: boolean; busyOnly?: boolean; badge?: { label: string; tone: string } | null }) {
  const { daySlots } = useDayWindows();
  const [open, setOpen] = useState<string | null>(null);
  // Закрытые окна и пустые прошедшие не показываем — они только шумят.
  const visible = daySlots(date).filter((s) => !s.removed && !(s.past && !s.appt && !s.group));
  // «Ближайшие» — занятые окна дня целиком, вместе с уже состоявшимися:
  // сессия, которая прошла час назад, пропадала с экрана вместе с днём, будто
  // её и не было. Пустые прошедшие окна по-прежнему не показываем.
  const slots = busyOnly ? visible.filter((s) => !!s.appt || !!s.group) : visible;
  const free = slots.filter((s) => !s.appt && !s.group && !s.past).length;
  const busy = slots.filter((s) => !!s.appt || !!s.group).length;
  const held = slots.filter((s) => (!!s.appt || !!s.group) && s.past).length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          {/* Число само по себе не говорит, какой это день: в ленте дней
              заголовок называет и месяц, и день недели. */}
          <h3 className="text-[13.5px] font-black">{cap(dLong.format(date))}</h3>
          {badge
            ? <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: `var(--${badge.tone}-soft)`, color: `var(--${badge.tone}-edge)` }}>{badge.label}</span>
            : today && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: "var(--olive-soft)", color: "var(--olive-edge)" }}>сегодня</span>}
        </div>
        <p className="text-[10.5px] font-black text-[var(--muted-2)]">
          {busyOnly
            ? `${busy} ${pl(busy, "запись", "записи", "записей")}${held ? ` · ${held} ${pl(held, "состоялась", "состоялось", "состоялось")}` : ""}`
            : busy > 0 ? `${free} свободно · ${busy} ${pl(busy, "запись", "записи", "записей")}` : free > 0 ? `${free} свободно` : "окон нет"}
        </p>
      </div>
      <div className="grid grid-cols-3 items-start gap-2">
        {slots.map((s) => (
          <SlotCell
            key={s.iso}
            slot={s}
            active={open === s.iso}
            onTap={() => { tap(); setOpen(open === s.iso ? null : s.iso); }}
            onClose={() => setOpen(null)}
          />
        ))}
        {!busyOnly && (
          <NewSlotCell
            date={date}
            taken={slots.map((s) => s.iso)}
            active={open === "new"}
            onTap={() => { tap(); setOpen(open === "new" ? null : "new"); }}
            onClose={() => setOpen(null)}
          />
        )}
      </div>
    </section>
  );
}

// Агенда недели — те же дни подряд.
export function WeekWindows() {
  const { hasWork } = useDayWindows();
  const days = useMemo(() => { const today = ymdLocal(new Date()); return Array.from({ length: 7 }, (_, i) => addDays(today, i)); }, []);
  // График не задан — неделя всё равно рисуется: разовое окно можно открыть
  // прямо здесь, не уходя в кабинет за расписанием на все недели вперёд.
  return (
    <div className="space-y-4">
      {!hasWork && <NoWorkHours />}
      {days.map((y, i) => <DayAgenda key={y} date={zoneDay(y)} today={i === 0} />)}
    </div>
  );
}

/* ——— Окно: один блок, компактный или раскрытый ——— */

type Look = { bg: string; ring?: string; label: string; labelColor: string };

function look(s: Slot): Look {
  // Встреча группы — тоном модуля «Группы и пары», как его карточка в
  // «Инструментах»: в дне сразу видно, что это не сессия один на один.
  if (s.group) return { bg: "var(--salmon-soft)", ring: "var(--salmon-edge)", label: s.group.title, labelColor: "var(--ink)" };
  // Занятое окно — светлая заливка тоном раздела; прошедшее ещё тише.
  // Занятое окно тоже в рамке — плитки дня выглядят одной сеткой.
  // Состоявшаяся встреча — зелёная, с галочкой в углу: она не «потухшая
  // запись», а сделанная работа, и в дне должна читаться именно так.
  if (s.appt && s.past) return { bg: "var(--green-soft)", ring: "var(--green-edge)", label: s.appt.client.name, labelColor: "var(--ink)" };
  // Клиент записался сам — окно занято, но встреча ещё не подтверждена: янтарь,
  // чтобы в дне сразу читалось, где от специалиста ждут ответа.
  if (s.appt && awaitsConfirm(s.appt)) return { bg: "var(--amber-soft)", ring: "var(--amber-edge)", label: s.appt.client.name, labelColor: "var(--ink)" };
  if (s.appt) return { bg: "var(--head-soft)", ring: "var(--edge)", label: s.appt.client.name, labelColor: "var(--ink)" };
  // Свободное окно белое и в тонкой рамке: заливка отличает занятое от пустого,
  // цвет времени суток живёт в редакторе графика и мешал бы здесь.
  return { bg: "#fff", ring: "var(--olive-edge)", label: "свободно", labelColor: "var(--olive-edge)" };
}

// Кнопки в раскрытом окне: узкая обводка и фиксированная низкая высота, текст
// в одну строку — иначе на узком экране слова переносятся и плитка распухает.
const THIN_BTN = { borderWidth: 1, minHeight: 0, lineHeight: 1 } as const;
const FLAT_BTN = "btn h-7 w-full whitespace-nowrap px-1.5 py-0 text-[10.5px]";

// Крестик закрытия в окнах сессий — зелёный в кружке, а не красный:
// закрыть плитку не разрушительно, красным здесь пугали зря.
const CLOSE_ROUND = { background: "#fff", border: "var(--bw) solid var(--olive-edge)", color: "var(--olive-edge)" } as const;

function CloseRound({ onClick, size = 30 }: { onClick: () => void; size?: number }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex shrink-0 items-center justify-center rounded-full text-[15px] font-black leading-none"
      style={{ width: size, height: size, ...CLOSE_ROUND }}
      aria-label="Закрыть"
    >
      ✕
    </button>
  );
}

// Клиента выбираем в модалке, а не поиском внутри плитки: поле ввода в сетке
// дня тянуло клавиатуру и перерисовывало всю ленту окон на каждую букву.
function PickClient({ onPick }: { onPick: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => { tap(); setOpen(true); }} className="btn h-9 w-full whitespace-nowrap py-0 text-[12.5px]" style={{ ...THIN_BTN, background: "var(--ink)", borderColor: "var(--ink)", color: "#fff" }}>
        <Icon name="plus" width={13} weight="bold" color="#fff" /> Выбрать клиента
      </button>
      {open && <ClientModal onClose={() => setOpen(false)} onPick={(id) => { setOpen(false); onPick(id); }} />}
    </>
  );
}

function ClientModal({ onClose, onPick }: { onClose: () => void; onPick: (id: number) => void }) {
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const create = useMutation({
    mutationFn: ({ name, contact }: { name: string; contact: string }) => createClient(name, contact),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ["clients"] }); onPick(c.id); },
  });
  const sorted = [...clients].sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1));
  if (typeof document === "undefined") return null;
  // Портал: у раскрытого окна свой слой и тени, внутри него шторка обрезалась.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 @md:items-center" style={{ background: "rgba(32,28,24,.44)" }} onClick={onClose}>
      <section onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[18px] p-3 stroke-lg" style={{ background: "var(--surface)", borderColor: "var(--olive-edge)" }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-black uppercase tracking-wide text-[var(--muted)]">Выбрать клиента</p>
          <CloseRound onClick={onClose} />
        </div>
        <ClientPicker clients={sorted} compact={false} onPick={onPick} onCreateClient={(name, contact) => create.mutate({ name, contact })} />
      </section>
    </div>,
    document.body,
  );
}

// Пустая плитка «+»: выбрать время и клиента прямо в сетке дня.
export function NewSlotCell({ date, taken, active, onTap, onClose }: { date: Date; taken: string[]; active: boolean; onTap: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const [iso, setIso] = useState<string | null>(null);
  const takenSet = new Set(taken);
  const now = Date.now();

  // Свободные получасовые метки дня, кроме занятых и прошедших.
  const times = useMemo(() => {
    const out: { iso: string; label: string }[] = [];
    for (let m = 8 * 60; m <= 21 * 60 + 30; m += 30) {
      const dt = zoneAt(ymdLocal(date), Math.floor(m / 60), m % 60) ?? new Date(NaN);
      const value = dt.toISOString();
      if (dt.getTime() < now || takenSet.has(value)) continue;
      out.push({ iso: value, label: timeF.format(dt) });
    }
    return out;
  }, [date, taken.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const [dur, setDur] = useState(50);
  const { ask, askNode } = useConfirmAsk();
  // Время выбрано заранее — первое свободное; всё меню видно одним экраном.
  const chosen = iso ?? times[0]?.iso ?? null;
  // Открыть окно, не назначая никого: клиента в него можно записать позже —
  // тапом по самому окну, как по любому свободному.
  const openWindow = useMutation({
    mutationFn: () => setOverride(chosen!, { added: true, dur, fmt: "online" }),
    onSuccess: () => {
      success();
      setIso(null); onClose();
      for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
  const book = useMutation({
    mutationFn: ({ clientId }: { clientId: number }) => createAppointment({ clientId, startsAt: chosen!, format: "online", durationMin: dur }),
    onSuccess: () => {
      success();
      setIso(null); onClose();
      for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });

  if (!active) {
    return (
      <button
        onClick={onTap}
        className="flex h-[54px] w-full flex-col items-center justify-center gap-0.5 rounded-[13px]"
        style={{ background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--edge-neutral)" }}
        aria-label="Добавить сессию"
      >
        <Icon name="plus" width={18} weight="bold" color="var(--muted)" />
        <span className="text-[9.5px] font-bold">добавить</span>
      </button>
    );
  }

  return (
    <div className="col-span-3 rounded-[13px] p-3.5" style={{ background: "var(--surface-2)" }}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12.5px] font-black">Новая сессия</p>
        <CloseRound onClick={() => { setIso(null); onClose(); }} size={28} />
      </div>
      {times.length === 0 ? (
        <p className="text-[12px] font-semibold text-[var(--muted-2)]">На этот день свободного времени не осталось.</p>
      ) : (
        <div className="space-y-2.5">
          {/* Строка 1 — время */}
          <div>
            <p className="t-micro mb-1.5">Время</p>
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {times.map((t) => (
                <button key={t.iso} onClick={() => { select(); setIso(t.iso); }} className="tnum shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-black" style={chosen === t.iso ? { background: "var(--edge)", color: "#fff" } : { background: "#fff" }}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Строка 2 — длительность ползунком */}
          <label className="flex items-center gap-2.5">
            <span className="t-micro inline-flex shrink-0 items-center gap-1"><Icon name="clock" width={11} weight="bold" color="var(--muted)" />Длительность</span>
            <input
              type="range" min={30} max={120} step={5} value={dur}
              onChange={(e) => { select(); setDur(Number(e.target.value)); }}
              className="min-w-0 flex-1 cursor-pointer"
              style={{ accentColor: "var(--edge)" }}
            />
            <span className="tnum shrink-0 text-[12px] font-black">{dur} мин</span>
          </label>

          {/* Строка 3 — окно само по себе; клиента можно выбрать сразу или потом */}
          <button
            onClick={() => { tap(); if (chosen) openWindow.mutate(); }}
            disabled={!chosen || openWindow.isPending}
            className="btn h-9 w-full whitespace-nowrap py-0 text-[12.5px] disabled:opacity-50"
            style={{ ...THIN_BTN, background: "#fff", borderColor: "var(--olive-edge)", color: "var(--olive-edge)" }}
          >
            <Icon name="clock" width={13} weight="bold" color="var(--olive-edge)" /> {openWindow.isPending ? "Открываем…" : "Открыть свободное окно"}
          </button>
          <PickClient onPick={(clientId) => ask({
            title: "Записать на встречу?",
            when: chosen ? `${cap(dLong.format(new Date(chosen)))} в ${timeF.format(new Date(chosen))} · ${dur} мин` : undefined,
            note: "Клиент увидит встречу в своём расписании и получит напоминание перед началом.",
            confirm: "Записать",
            tone: "green",
            icon: "check",
            run: () => book.mutate({ clientId }),
          })} />
          <p className="t-cap text-center">Окно останется свободным — клиента можно записать позже.</p>
          {askNode}
        </div>
      )}
    </div>
  );
}

// Окно занято группой. Раскрывать его нечем: состав, посещаемость и задания
// живут в карточке группы — плитка просто ведёт туда.
function GroupCell({ slot }: { slot: Slot }) {
  const g = slot.group!;
  const st = look(slot);
  // Плитка та же по размеру, что у обычной записи: группа не должна раздувать
  // сетку дня. Узнаётся по стопке лиц и названию вместо имени клиента.
  const shown = g.members.slice(0, 2);
  const rest = g.members.length - shown.length;
  // Прошедшая встреча без отметок — то самое «отметьте, кто был» с дашборда.
  const needsMark = slot.past && !g.marked;
  return (
    <Link
      href={`/groups/?id=${g.groupId}`}
      onClick={() => tap()}
      className="relative flex min-h-[60px] items-center justify-center gap-1.5 pb-1.5 pl-1.5 pr-3 pt-4"
      style={{ borderRadius: 13, background: st.bg, border: `1px solid ${st.ring}` }}
    >
      <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5">
        <Icon name="clock" width={9} weight="bold" color="var(--muted-2)" />
        <span className="tnum text-[8.5px] font-black text-[var(--muted-2)]">{slot.dur}</span>
      </span>
      <span className="absolute right-1.5 top-1.5">
        {needsMark
          ? <Icon name="clock" width={10} weight="bold" color="var(--amber-edge)" />
          : g.done
            ? <Icon name="check" width={10} weight="bold" color="var(--green-edge)" />
            : <Icon name="users" width={10} weight="fill" color="var(--salmon-edge)" />}
      </span>
      <span className="flex shrink-0 items-center -space-x-2">
        {shown.map((m) => (
          <ClientAvatar
            key={m.id}
            name={m.name}
            photo={m.photo}
            className="h-[21px] w-[21px] rounded-full text-[9.5px] font-black leading-none"
            style={{ background: "#fff", border: "1px solid var(--edge-neutral)" }}
          />
        ))}
        {rest > 0 && (
          <span className="flex h-[21px] w-[21px] items-center justify-center rounded-full text-[8.5px] font-black leading-none" style={{ background: "#fff", border: "1px solid var(--edge-neutral)" }}>
            +{rest}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col items-center gap-0.5 text-center">
        <span className="tnum text-[13.5px] font-black leading-none">{slot.t}</span>
        <span className="block w-full break-words text-[9.5px] font-bold leading-[1.05]" style={{ color: st.labelColor }}>{st.label}</span>
      </span>
    </Link>
  );
}

export function SlotCell({ slot, active, onTap, onClose }: { slot: Slot; active: boolean; onTap: () => void; onClose: () => void }) {
  if (slot.group) return <GroupCell slot={slot} />;
  const st = look(slot);
  return (
    <div
      className={active ? "col-span-3" : ""}
      style={{
        borderRadius: 13,
        background: st.bg,
        border: st.ring ? `1px solid ${st.ring}` : "none",
        opacity: slot.past && !slot.appt && !active ? 0.6 : 1,
        boxShadow: active ? "0 14px 30px -18px rgba(32,28,24,.45)" : "none",
        zIndex: active ? 2 : 1,
      }}
    >
      <button
        onClick={onTap}
        disabled={slot.past && !slot.appt && !active}
        className={active ? "flex w-full items-center gap-3 px-3.5 pt-3.5 text-left" : `relative flex min-h-[60px] w-full items-center justify-center gap-1.5 pb-1.5 pt-4 ${slot.appt ? "pl-1.5 pr-3" : "px-1.5"}`}
        aria-expanded={active}
      >
        {active ? (
          <>
            <span className="tnum text-[17px] font-black leading-none">{slot.t}</span>
            {/* В раскрытом окне дата и время — чернилами, а не тоном окна */}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] font-bold leading-[1.05] text-[var(--ink)]">
                <span className="inline-flex items-center gap-1"><Icon name="clock" width={12} weight="bold" color="var(--muted)" />{slot.dur} мин</span>
                <span className="inline-flex items-center gap-1"><Icon name="calendar" width={12} weight="bold" color="var(--muted)" />{cap(dLong.format(new Date(slot.iso)))}</span>
              </span>
            </span>
          </>
        ) : (
          // Занятое окно узнаётся по лицу: квадратик клиента и подпись стоят
          // общей парой по центру плитки.
          <>
            {slot.appt && (
              <ClientAvatar
                name={slot.appt.client.name}
                photo={slot.appt.client.photo}
                className="h-[27px] w-[27px] rounded-[8px] text-[12px] font-black leading-none"
                style={{ background: "#fff", border: "1px solid var(--edge-neutral)" }}
              />
            )}
            {/* И свободное, и занятое окно держат содержимое по центру плитки */}
            <span className="flex min-w-0 flex-col items-center gap-0.5 text-center">
              {/* Зачёркнуто только пустое прошедшее окно: состоявшаяся встреча
                  не «просрочена», её провели. */}
              <span className={`tnum text-[13.5px] font-black leading-none ${slot.past && !slot.appt ? "line-through" : ""}`}>{slot.t}</span>
              <span className="block w-full break-words text-[9.5px] font-bold leading-[1.05]" style={{ color: st.labelColor }}>{st.label}</span>
            </span>
          </>
        )}
        {!active && (
          <>
            <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5">
              <Icon name="clock" width={9} weight="bold" color="var(--muted-2)" />
              <span className="tnum text-[8.5px] font-black text-[var(--muted-2)]">{slot.dur}</span>
            </span>
            <span className="absolute right-1.5 top-1.5">
              {slot.appt && slot.past
                ? <Icon name="check" width={10} weight="bold" color="var(--green-edge)" />
                : slot.appt && awaitsConfirm(slot.appt)
                  ? <Icon name="clock" width={10} weight="bold" color="var(--amber-edge)" />
                  : <Icon name={slot.fmt === "online" ? "video" : "pin"} width={10} weight="fill" color="var(--muted-2)" />}
            </span>
          </>
        )}
        {/* Не кнопка: вся шапка окна и так сворачивает его по тапу */}
        {active && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-black leading-none" style={CLOSE_ROUND}>✕</span>}
      </button>

      <AnimatePresence initial={false}>
        {active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-3"><SlotBody slot={slot} onClose={onClose} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Начинка раскрытого окна: свободное — запись/закрыть; занятое — перенос/отмена.
function SlotBody({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const qc = useQueryClient();
  const inv = () => { for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] }); };
  const [resch, setResch] = useState(false);
  const [needsPro, setNeedsPro] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { ask, askNode } = useConfirmAsk();
  const whenLabel = `${cap(dLong.format(new Date(slot.iso)))} в ${timeF.format(new Date(slot.iso))}`;
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients, enabled: !!slot.appt });
  const apptClient = clients.find((c) => c.id === slot.appt?.client.id) ?? null;
  const tgLink = apptClient ? chatLink(apptClient) : null;

  const book = useMutation({ mutationFn: ({ clientId, format }: { clientId: number; format: ApptFormat }) => createAppointment({ clientId, startsAt: slot.iso, format }), onSuccess: () => { success(); onClose(); inv(); } });
  const setFmt = useMutation({ mutationFn: async (format: ApptFormat) => { if (slot.appt) await updateAppointment(slot.appt.id, { format }); else await setOverride(slot.iso, { fmt: format }); }, onSuccess: () => { select(); inv(); } });
  const cancel = useMutation({ mutationFn: () => updateAppointment(slot.appt!.id, { status: "cancelled" }), onSuccess: () => { onClose(); inv(); } });
  // Отказ по лимиту показываем предложением PRO, а не молчанием: кнопка
  // «Подтвердить» иначе просто ничего не делает.
  const confirm = useMutation({
    mutationFn: () => confirmAppointment(slot.appt!.id),
    onSuccess: () => { success(); setConfirmed(true); inv(); },
    onError: (e) => { if (isNeedsPro(e)) setNeedsPro(true); },
  });
  const move = useMutation({ mutationFn: (iso: string) => updateAppointment(slot.appt!.id, { startsAt: iso }), onSuccess: () => { success(); onClose(); inv(); } });
  const closeWin = useMutation({ mutationFn: () => setOverride(slot.iso, { removed: true }), onSuccess: () => { onClose(); inv(); } });

  if (slot.appt) {
    if (resch) {
      return (
        <div className="rounded-[11px] bg-white p-2.5">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Новое окно</p>
          <SlotPicker variant="calendar" showAvail onPick={(iso) => ask({
            title: "Перенести встречу?",
            when: `${cap(dLong.format(new Date(iso)))} в ${timeF.format(new Date(iso))}`,
            note: `Сейчас встреча стоит на ${whenLabel.toLowerCase()}. ${slot.appt!.client.name} получит уведомление о новом времени.`,
            confirm: "Перенести",
            tone: "accent",
            icon: "swap",
            run: () => move.mutate(iso),
          })} />
          <button onClick={() => setResch(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
          {askNode}
        </div>
      );
    }
    return (
      <div className="space-y-2.5">
        {/* Имя сверху, действия — строкой под ним */}
        <div className="flex items-center gap-3">
          <ClientAvatar name={slot.appt.client.name} photo={slot.appt.client.photo} className="h-[54px] w-[54px] rounded-[16px] text-[21px] font-black" style={{ background: "#fff" }} />
          <span className="min-w-0 break-words text-[19px] font-black leading-tight">{slot.appt.client.name}</span>
          <span className="ml-auto shrink-0"><FmtSwitch fmt={slot.appt.format} onToggle={() => setFmt.mutate(slot.appt!.format === "online" ? "offline" : "online")} /></span>
        </div>
        {slot.past && (
          <div className="flex items-center gap-1.5 rounded-[11px] px-2.5 py-1.5" style={{ background: "var(--green-soft)" }}>
            <Icon name="check" width={12} weight="bold" color="var(--green-edge)" />
            <span className="text-[11.5px] font-black" style={{ color: "var(--green-edge)" }}>Сессия состоялась</span>
          </div>
        )}
        {!slot.past && awaitsConfirm(slot.appt) && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 rounded-[11px] px-2.5 py-2" style={{ background: "var(--amber-edge)" }}>
              <Icon name="clock" width={13} weight="bold" color="#fff" />
              <span className="text-[11.5px] font-black text-white">Клиент записался сам — ждёт подтверждения</span>
            </div>
            <ConfirmActions
              onConfirm={() => ask({
                title: "Подтвердить встречу?",
                when: whenLabel,
                note: `${slot.appt!.client.name} получит уведомление, что встреча в силе.`,
                confirm: "Подтвердить",
                tone: "green",
                icon: "check",
                run: () => confirm.mutate(),
              })}
              onDecline={() => ask({
                title: "Отклонить запись?",
                when: whenLabel,
                note: `Окно снова станет свободным, а ${slot.appt!.client.name} узнает, что встреча не состоится.`,
                confirm: "Отклонить",
                tone: "danger",
                icon: "close",
                run: () => cancel.mutate(),
              })}
              confirming={confirm.isPending}
              declining={cancel.isPending}
            />
          </div>
        )}
        <ConfirmProPaywall open={needsPro} onClose={() => setNeedsPro(false)} />
        <ConfirmDone open={confirmed} onClose={() => setConfirmed(false)} />
        {/* Перенести и «Написать» — строкой, «Освободить» под «Перенести»
            той же шириной: отмена в общей сетке, но своим рядом. */}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => setResch(true)} className={`${FLAT_BTN} btn-accent gap-1.5`} style={THIN_BTN}>
            <Icon name="swap" width={12} weight="bold" color="#fff" /> Перенести
          </button>
          {/* Написать — прямо в личный чат Telegram, если контакт это username. */}
          {tgLink ? (
            <a href={tgLink} target="_blank" rel="noreferrer" className={FLAT_BTN} style={{ ...THIN_BTN, background: "var(--ink)", borderColor: "var(--ink)", color: "#fff" }}>
              <Icon name="telegram" width={12} weight="fill" color="#fff" /> Написать
            </a>
          ) : (
            <Link href={`/clients/${slot.appt.client.id}`} className={FLAT_BTN} style={{ ...THIN_BTN, background: "var(--ink)", borderColor: "var(--ink)", color: "#fff" }}>
              <Icon name="telegram" width={12} weight="fill" color="#fff" /> Написать
            </Link>
          )}
          {/* Отмена снимает запись, но окно остаётся свободным — не удаляем его. */}
          {!slot.past && (
            <button
              onClick={() => ask({
                title: "Освободить окно?",
                when: whenLabel,
                note: `Запись ${slot.appt!.client.name} будет отменена, а окно снова станет свободным. Клиент получит уведомление.`,
                confirm: "Освободить",
                tone: "danger",
                icon: "close",
                run: () => cancel.mutate(),
              })}
              className={`${FLAT_BTN} gap-1.5`}
              style={{ ...THIN_BTN, background: "var(--salmon-edge)", borderColor: "var(--salmon-edge)", color: "#fff" }}
            >
              <Icon name="close" width={12} weight="bold" color="#fff" /> Освободить
            </button>
          )}
        </div>
        {askNode}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <p className="t-micro mr-auto">Кого записать?</p>
        <FmtSwitch fmt={slot.fmt} onToggle={() => setFmt.mutate(slot.fmt === "online" ? "offline" : "online")} />
      </div>
      <PickClient onPick={(id) => ask({
        title: "Записать на встречу?",
        when: whenLabel,
        note: `${clients.find((c) => c.id === id)?.name ?? "Клиент"} увидит встречу в своём расписании и получит напоминание перед началом.`,
        confirm: "Записать",
        tone: "green",
        icon: "check",
        run: () => book.mutate({ clientId: id, format: slot.fmt }),
      })} />
      {/* Удаление — текстом в правом нижнем углу: разрушающее действие не должно
          спорить по весу с основным сценарием «кого записать». */}
      <div className="flex justify-end pt-0.5">
        <button
          onClick={() => ask({
            title: "Удалить окно?",
            when: whenLabel,
            note: "Окно пропадёт из расписания — клиенты больше не смогут записаться на это время.",
            confirm: "Удалить",
            tone: "danger",
            icon: "close",
            run: () => closeWin.mutate(),
          })}
          className="inline-flex items-center gap-1 text-[12px] font-black"
          style={{ color: "var(--danger)" }}
        >
          <Icon name="close" width={11} weight="bold" color="var(--danger)" /> Удалить окно
        </button>
      </div>
      {askNode}
    </div>
  );
}
