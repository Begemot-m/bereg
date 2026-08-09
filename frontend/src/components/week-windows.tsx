"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ClientPicker } from "@/components/day-slots";
import { FmtSwitch } from "@/components/fmt-switch";
import { Icon } from "@/components/icons";
import { SlotPicker } from "@/components/slot-picker";
import { createAppointment, listAppointments, updateAppointment, type Appointment, type ApptFormat } from "@/lib/appointments";
import { createClient, isPhone, listClients } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { getOverrides, getWorkHours, setOverride } from "@/lib/schedule";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const wdF = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const dLong = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pl = (n: number, one: string, few: string, many: string) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };

export type Slot = { iso: string; hour: number; t: string; dur: number; fmt: ApptFormat; past: boolean; appt?: Appointment; removed: boolean };

// Окна дня собираются из графика + записей, которые в график не попали.
export function useDayWindows() {
  const { data: work } = useQuery({ queryKey: ["work-hours"], queryFn: getWorkHours });
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const { data: overrides = {} } = useQuery({ queryKey: ["overrides"], queryFn: getOverrides });

  const daySlots = (d: Date): Slot[] => {
    const wd = (d.getDay() + 6) % 7;
    const now = Date.now();
    const schedule: Slot[] = [...(work?.hours?.[wd] ?? [])].sort((a, b) => a.t.localeCompare(b.t)).map((s) => {
      const [hh, mm] = s.t.split(":").map(Number);
      const dt = new Date(d); dt.setHours(hh, mm, 0, 0);
      const iso = dt.toISOString(); const ov = overrides[iso];
      const appt = appts.find((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() === dt.getTime());
      return { iso, hour: hh, t: s.t, dur: appt?.durationMin ?? s.d, fmt: (ov?.fmt ?? s.fmt) as ApptFormat, past: dt.getTime() < now, appt, removed: !!ov?.removed };
    });
    const apptOnly: Slot[] = appts
      .filter((a) => a.status !== "cancelled" && sameDay(new Date(a.startsAt), d) && !schedule.some((s) => new Date(s.iso).getTime() === new Date(a.startsAt).getTime()))
      .map((a) => { const dt = new Date(a.startsAt); return { iso: a.startsAt, hour: dt.getHours(), t: timeF.format(dt), dur: a.durationMin, fmt: a.format, past: dt.getTime() < now, appt: a, removed: false }; });
    return [...schedule, ...apptOnly].sort((a, b) => a.iso.localeCompare(b.iso));
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
  const visible = daySlots(date).filter((s) => !s.removed && !(s.past && !s.appt));
  // «Ближайшие» — только занятые окна впереди: раздел про встречи, не про график.
  const slots = busyOnly ? visible.filter((s) => !!s.appt && !s.past) : visible;
  const free = slots.filter((s) => !s.appt && !s.past).length;
  const busy = slots.filter((s) => !!s.appt).length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <h3 className="text-[13.5px] font-black">{cap(wdF.format(date))}, {date.getDate()}</h3>
          {badge
            ? <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: `var(--${badge.tone}-soft)`, color: `var(--${badge.tone}-edge)` }}>{badge.label}</span>
            : today && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: "var(--olive-soft)", color: "var(--olive-edge)" }}>сегодня</span>}
        </div>
        <p className="text-[10.5px] font-black text-[var(--muted-2)]">
          {busyOnly
            ? `${busy} ${pl(busy, "запись", "записи", "записей")}`
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
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  if (!hasWork) return <NoWorkHours />;
  return (
    <div className="space-y-4">
      {days.map((d, i) => <DayAgenda key={d.toDateString()} date={d} today={i === 0} />)}
    </div>
  );
}

/* ——— Окно: один блок, компактный или раскрытый ——— */

type Look = { bg: string; ring?: string; label: string; labelColor: string };

// Свободные окна красятся по времени суток: утро светло-зелёное, вечер
// лавандовый. День читается сплошным градиентом сверху вниз, и по цвету плитки
// видно, к какой части дня она относится, без чтения цифр.
const MORNING = { fill: [230, 240, 220], edge: [91, 128, 66] };
const EVENING = { fill: [214, 203, 236], edge: [144, 119, 189] };
const rgb = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const mix = (from: number[], to: number[], k: number) => from.map((v, i) => Math.round(v + (to[i] - v) * k));

export function dayTint(hour: number) {
  const k = Math.min(1, Math.max(0, (hour - 7) / 14)); // 07:00 — утро, 21:00 — вечер
  return { fill: rgb(mix(MORNING.fill, EVENING.fill, k)), edge: rgb(mix(MORNING.edge, EVENING.edge, k)) };
}

function look(s: Slot): Look {
  // Занятое окно — светлая заливка тоном раздела; прошедшее ещё тише.
  // Занятое окно тоже в рамке — плитки дня выглядят одной сеткой.
  if (s.appt) return { bg: s.past ? "var(--surface-2)" : "var(--head-soft)", ring: "var(--edge)", label: s.appt.client.name, labelColor: "var(--ink)" };
  // Свободное окно: заливка и рамка по времени суток.
  const tint = dayTint(s.hour);
  return { bg: tint.fill, ring: tint.edge, label: "свободно", labelColor: tint.edge };
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
function NewSlotCell({ date, taken, active, onTap, onClose }: { date: Date; taken: string[]; active: boolean; onTap: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const [iso, setIso] = useState<string | null>(null);
  const takenSet = new Set(taken);
  const now = Date.now();

  // Свободные получасовые метки дня, кроме занятых и прошедших.
  const times = useMemo(() => {
    const out: { iso: string; label: string }[] = [];
    for (let m = 8 * 60; m <= 21 * 60 + 30; m += 30) {
      const dt = new Date(date); dt.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const value = dt.toISOString();
      if (dt.getTime() < now || takenSet.has(value)) continue;
      out.push({ iso: value, label: timeF.format(dt) });
    }
    return out;
  }, [date, taken.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const [dur, setDur] = useState(50);
  // Время выбрано заранее — первое свободное; всё меню видно одним экраном.
  const chosen = iso ?? times[0]?.iso ?? null;
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

          {/* Строка 3 — клиент, списком в модалке */}
          <PickClient onPick={(clientId) => book.mutate({ clientId })} />
        </div>
      )}
    </div>
  );
}

function SlotCell({ slot, active, onTap, onClose }: { slot: Slot; active: boolean; onTap: () => void; onClose: () => void }) {
  const st = look(slot);
  return (
    <div
      className={active ? "col-span-3" : ""}
      style={{
        borderRadius: 13,
        background: st.bg,
        border: st.ring ? `1px solid ${st.ring}` : "none",
        opacity: slot.past && !active ? 0.6 : 1,
        boxShadow: active ? "0 14px 30px -18px rgba(32,28,24,.45)" : "none",
        zIndex: active ? 2 : 1,
      }}
    >
      <button
        onClick={onTap}
        disabled={slot.past && !slot.appt && !active}
        className={active ? "flex w-full items-center gap-3 px-3.5 pt-3.5 text-left" : "relative flex min-h-[60px] w-full flex-col items-center justify-center gap-0.5 px-1 py-2"}
        aria-expanded={active}
      >
        <span className={`tnum font-black leading-none ${active ? "text-[17px]" : "text-[13.5px]"} ${slot.past ? "line-through" : ""}`}>{slot.t}</span>
        <span className={`min-w-0 ${active ? "flex-1" : "max-w-full"}`}>
          {/* В раскрытом окне дата и время — чернилами, а не тоном окна */}
          {active ? (
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] font-bold leading-[1.05] text-[var(--ink)]">
              <span className="inline-flex items-center gap-1"><Icon name="clock" width={12} weight="bold" color="var(--muted)" />{slot.dur} мин</span>
              <span className="inline-flex items-center gap-1"><Icon name="calendar" width={12} weight="bold" color="var(--muted)" />{cap(dLong.format(new Date(slot.iso)))}</span>
            </span>
          ) : (
            <span className="block break-words text-[9.5px] font-bold leading-[1.05]" style={{ color: st.labelColor }}>{st.label}</span>
          )}
        </span>
        {!active && (
          <>
            <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5">
              <Icon name="clock" width={9} weight="bold" color="var(--muted-2)" />
              <span className="tnum text-[8.5px] font-black text-[var(--muted-2)]">{slot.dur}</span>
            </span>
            <span className="absolute right-1.5 top-1.5"><Icon name={slot.fmt === "online" ? "video" : "pin"} width={10} weight="fill" color="var(--muted-2)" /></span>
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
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients, enabled: !!slot.appt });
  const contact = clients.find((c) => c.id === slot.appt?.client.id)?.contact ?? null;
  const tgLink = contact && !isPhone(contact)
    ? `https://t.me/${contact.replace(/^@/, "")}?text=${encodeURIComponent("Здравствуйте! Пишу из «Хроники».")}`
    : null;

  const book = useMutation({ mutationFn: ({ clientId, format }: { clientId: number; format: ApptFormat }) => createAppointment({ clientId, startsAt: slot.iso, format }), onSuccess: () => { success(); onClose(); inv(); } });
  const setFmt = useMutation({ mutationFn: async (format: ApptFormat) => { if (slot.appt) await updateAppointment(slot.appt.id, { format }); else await setOverride(slot.iso, { fmt: format }); }, onSuccess: () => { select(); inv(); } });
  const cancel = useMutation({ mutationFn: () => updateAppointment(slot.appt!.id, { status: "cancelled" }), onSuccess: () => { onClose(); inv(); } });
  const move = useMutation({ mutationFn: (iso: string) => updateAppointment(slot.appt!.id, { startsAt: iso }), onSuccess: () => { success(); onClose(); inv(); } });
  const closeWin = useMutation({ mutationFn: () => setOverride(slot.iso, { removed: true }), onSuccess: () => { onClose(); inv(); } });

  if (slot.appt) {
    if (resch) {
      return (
        <div className="rounded-[11px] bg-white p-2.5">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Новое окно</p>
          <SlotPicker variant="calendar" showAvail onPick={(iso) => move.mutate(iso)} />
          <button onClick={() => setResch(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
        </div>
      );
    }
    return (
      <div className="space-y-2.5">
        {/* Имя сверху, действия — строкой под ним */}
        <div className="flex items-center gap-3">
          <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[16px] text-[21px] font-black" style={{ background: "#fff" }}>{slot.appt.client.name.charAt(0)}</span>
          <span className="min-w-0 break-words text-[19px] font-black leading-tight">{slot.appt.client.name}</span>
          <span className="ml-auto shrink-0"><FmtSwitch fmt={slot.appt.format} onToggle={() => setFmt.mutate(slot.appt!.format === "online" ? "offline" : "online")} /></span>
        </div>
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
            <button onClick={() => cancel.mutate()} className={`${FLAT_BTN} gap-1.5`} style={{ ...THIN_BTN, background: "var(--salmon-edge)", borderColor: "var(--salmon-edge)", color: "#fff" }}>
              <Icon name="close" width={12} weight="bold" color="#fff" /> Освободить
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <p className="t-micro mr-auto">Кого записать?</p>
        <FmtSwitch fmt={slot.fmt} onToggle={() => setFmt.mutate(slot.fmt === "online" ? "offline" : "online")} />
      </div>
      <PickClient onPick={(id) => book.mutate({ clientId: id, format: slot.fmt })} />
      {/* Удаление — текстом в правом нижнем углу: разрушающее действие не должно
          спорить по весу с основным сценарием «кого записать». */}
      <div className="flex justify-end pt-0.5">
        <button onClick={() => closeWin.mutate()} className="inline-flex items-center gap-1 text-[12px] font-black" style={{ color: "var(--danger)" }}>
          <Icon name="close" width={11} weight="bold" color="var(--danger)" /> Удалить окно
        </button>
      </div>
    </div>
  );
}
