"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FmtSwitch } from "@/components/fmt-switch";
import { Icon } from "@/components/icons";
import { SlotPicker } from "@/components/slot-picker";
import { createAppointment, listAppointments, updateAppointment, type Appointment, type ApptFormat } from "@/lib/appointments";
import { createClient, listClients } from "@/lib/clients";
import { select, success, tap } from "@/lib/haptics";
import { getOverrides, getWorkHours, setOverride } from "@/lib/schedule";

const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const wdF = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const dLong = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pl = (n: number, one: string, few: string, many: string) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };

const MORPH = { type: "spring" as const, stiffness: 420, damping: 34 };

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
    <div className="rounded-[14px] py-6 text-center text-[13px] font-semibold text-[var(--muted)]" style={{ background: "#fff" }}>
      Окна ещё не заданы.<br /><Link href="/cabinet" className="font-extrabold underline">Настроить график в кабинете →</Link>
    </div>
  );
}

// Агенда одного дня. Тап по окну не открывает меню снизу — само окно
// разворачивается в широкий блок и сворачивается обратно.
export function DayAgenda({ date, today }: { date: Date; today?: boolean }) {
  const { daySlots } = useDayWindows();
  const [open, setOpen] = useState<string | null>(null);
  // Закрытые окна и пустые прошедшие не показываем — они только шумят.
  const slots = daySlots(date).filter((s) => !s.removed && !(s.past && !s.appt));
  const free = slots.filter((s) => !s.appt && !s.past).length;
  const busy = slots.filter((s) => !!s.appt).length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <h3 className="text-[13.5px] font-black">{cap(wdF.format(date))}, {date.getDate()}</h3>
          {today && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: "var(--olive-soft)", color: "var(--olive-edge)" }}>сегодня</span>}
        </div>
        <p className="text-[10.5px] font-black text-[var(--muted-2)]">
          {busy > 0 ? `${free} свободно · ${busy} ${pl(busy, "запись", "записи", "записей")}` : free > 0 ? `${free} свободно` : "окон нет"}
        </p>
      </div>
      <motion.div layout transition={MORPH} className="grid grid-cols-3 items-start gap-2">
        {slots.map((s) => (
          <SlotCell
            key={s.iso}
            slot={s}
            active={open === s.iso}
            onTap={() => { tap(); setOpen(open === s.iso ? null : s.iso); }}
            onClose={() => setOpen(null)}
          />
        ))}
        <NewSlotCell
          date={date}
          taken={slots.map((s) => s.iso)}
          active={open === "new"}
          onTap={() => { tap(); setOpen(open === "new" ? null : "new"); }}
          onClose={() => setOpen(null)}
        />
      </motion.div>
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

function look(s: Slot): Look {
  if (s.appt) return { bg: s.past ? "var(--purple-soft)" : "var(--purple)", label: s.appt.client.name.split(" ")[0], labelColor: "var(--ink)" };
  // Свободное окно — пунктир: рамка здесь означает «сюда можно записать».
  return { bg: "#fff", ring: "var(--olive-edge)", label: "свободно", labelColor: "var(--olive-edge)" };
}

// Выбор клиента: чипы недавних, поиск когда их много, и создание нового
// прямо отсюда — чтобы не уходить в раздел «Клиенты» посреди записи.
function ClientChips({ onPick }: { onPick: (id: number) => void }) {
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: (value: string) => createClient(value, ""),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ["clients"] }); onPick(c.id); },
  });

  const q = query.trim().toLowerCase();
  const list = [...clients]
    .sort((a, b) => (a.status === "therapy" ? 0 : 1) - (b.status === "therapy" ? 0 : 1))
    .filter((c) => !q || c.name.toLowerCase().includes(q));

  if (adding) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(name.trim()); }}
        className="flex items-center gap-2"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя нового клиента"
          className="min-w-0 flex-1 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-bold outline-none placeholder:font-normal placeholder:text-[var(--muted-2)]"
        />
        <button type="submit" disabled={!name.trim() || create.isPending} className="shrink-0 rounded-full px-3.5 py-2 text-[12px] font-black disabled:opacity-40" style={{ background: "var(--olive)", color: "var(--olive-edge)" }}>Записать</button>
        <button type="button" onClick={() => { tap(); setAdding(false); }} className="shrink-0 text-[12px] font-black text-[var(--muted-2)]">Отмена</button>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      {clients.length > 6 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени"
          className="w-full rounded-full bg-white px-3.5 py-2 text-[12.5px] font-bold outline-none placeholder:font-normal placeholder:text-[var(--muted-2)]"
        />
      )}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        <button
          onClick={() => { tap(); setAdding(true); }}
          className="flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-[12px] font-black"
          style={{ background: "var(--olive-soft)", color: "var(--olive-edge)" }}
        >
          <Icon name="plus" width={14} weight="bold" color="var(--olive-edge)" /> Новый
        </button>
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => { select(); onPick(c.id); }}
            className="flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[12px] font-black"
            style={{ background: "#fff" }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black" style={{ background: c.status === "therapy" ? "var(--green-soft)" : "var(--surface-2)" }}>{c.name.charAt(0)}</span>
            {c.name.split(" ")[0]}
          </button>
        ))}
        {list.length === 0 && <span className="px-1 py-1.5 text-[12px] font-semibold text-[var(--muted-2)]">Никого не нашли</span>}
      </div>
    </div>
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
  const book = useMutation({
    mutationFn: ({ clientId }: { clientId: number }) => createAppointment({ clientId, startsAt: iso!, format: "online", durationMin: dur }),
    onSuccess: () => {
      success();
      setIso(null); onClose();
      for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });

  if (!active) {
    return (
      <motion.button
        layout
        transition={MORPH}
        onClick={onTap}
        className="flex h-[54px] w-full flex-col items-center justify-center gap-0.5 rounded-[14px]"
        style={{ background: "var(--surface-2)", color: "var(--muted)" }}
        aria-label="Добавить сессию"
      >
        <Icon name="plus" width={18} weight="bold" color="var(--muted)" />
        <span className="text-[9.5px] font-bold">добавить</span>
      </motion.button>
    );
  }

  return (
    <motion.div layout transition={MORPH} className="col-span-3 rounded-[14px] p-3.5" style={{ background: "var(--surface-2)" }}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12.5px] font-black">{iso ? `Кому на ${timeF.format(new Date(iso))}?` : "Во сколько?"}</p>
        <button onClick={() => { setIso(null); onClose(); }} className="text-[15px] font-black text-[var(--muted-2)]" aria-label="Закрыть">✕</button>
      </div>
      {iso ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="t-cap inline-flex items-center gap-1.5"><Icon name="clock" width={13} weight="bold" color="var(--muted)" /> Длительность</span>
            <div className="flex gap-1">
              {[30, 50, 60, 90].map((value) => (
                <button
                  key={value}
                  onClick={() => { select(); setDur(value); }}
                  className="tnum rounded-full px-2.5 py-1 text-[11.5px] font-black"
                  style={dur === value ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", color: "var(--muted)" }}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <ClientChips onPick={(clientId) => book.mutate({ clientId })} />
        </div>
      ) : times.length === 0 ? (
        <p className="text-[12px] font-semibold text-[var(--muted-2)]">На этот день свободного времени не осталось.</p>
      ) : (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {times.map((t) => (
            <button key={t.iso} onClick={() => { select(); setIso(t.iso); }} className="tnum shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-black" style={{ background: "#fff" }}>{t.label}</button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function SlotCell({ slot, active, onTap, onClose }: { slot: Slot; active: boolean; onTap: () => void; onClose: () => void }) {
  const st = look(slot);
  return (
    <motion.div
      layout
      transition={MORPH}
      className={active ? "col-span-3" : ""}
      style={{
        borderRadius: 14,
        background: st.bg,
        border: st.ring ? `2px dashed ${st.ring}` : "none",
        opacity: slot.past && !active ? 0.6 : 1,
        boxShadow: active ? "0 14px 30px -18px rgba(32,28,24,.45)" : "none",
        zIndex: active ? 2 : 1,
      }}
    >
      <motion.button
        layout="position"
        onClick={onTap}
        disabled={slot.past && !slot.appt && !active}
        className={active ? "flex w-full items-center gap-3 px-3.5 pt-3.5 text-left" : "relative flex h-[54px] w-full flex-col items-center justify-center gap-0.5 px-1"}
        aria-expanded={active}
      >
        <span className={`tnum font-black leading-none ${active ? "text-[17px]" : "text-[13.5px]"} ${slot.past ? "line-through" : ""}`}>{slot.t}</span>
        <span className={`min-w-0 ${active ? "flex-1" : "max-w-full"}`}>
          <span className={`block truncate font-bold ${active ? "text-[12.5px]" : "text-[9.5px]"}`} style={{ color: st.labelColor }}>
            {active ? `${slot.dur} мин · ${cap(dLong.format(new Date(slot.iso)))}` : st.label}
          </span>
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
        {active && <span className="text-[15px] font-black text-[var(--muted-2)]">✕</span>}
      </motion.button>

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
    </motion.div>
  );
}

// Начинка раскрытого окна: свободное — запись/закрыть; занятое — перенос/отмена.
function SlotBody({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const qc = useQueryClient();
  const inv = () => { for (const k of ["appointments", "slots", "month-avail", "overrides"]) qc.invalidateQueries({ queryKey: [k] }); };
  const [resch, setResch] = useState(false);

  const book = useMutation({ mutationFn: ({ clientId, format }: { clientId: number; format: ApptFormat }) => createAppointment({ clientId, startsAt: slot.iso, format }), onSuccess: () => { success(); onClose(); inv(); } });
  const setFmt = useMutation({ mutationFn: async (format: ApptFormat) => { if (slot.appt) await updateAppointment(slot.appt.id, { format }); else await setOverride(slot.iso, { fmt: format }); }, onSuccess: () => { select(); inv(); } });
  const cancel = useMutation({ mutationFn: () => updateAppointment(slot.appt!.id, { status: "cancelled" }), onSuccess: () => { onClose(); inv(); } });
  const move = useMutation({ mutationFn: (iso: string) => updateAppointment(slot.appt!.id, { startsAt: iso }), onSuccess: () => { success(); onClose(); inv(); } });
  const closeWin = useMutation({ mutationFn: () => setOverride(slot.iso, { removed: true }), onSuccess: () => { onClose(); inv(); } });

  if (slot.appt) {
    if (resch) {
      return (
        <div className="rounded-[12px] bg-white p-2.5">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Новое окно</p>
          <SlotPicker variant="calendar" showAvail onPick={(iso) => move.mutate(iso)} />
          <button onClick={() => setResch(false)} className="mt-2 text-[12px] font-semibold text-[var(--muted)]">Отмена</button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <span className="mr-auto flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black" style={{ background: "#fff" }}>{slot.appt.client.name.charAt(0)}</span>
          <span className="truncate text-[13px] font-black">{slot.appt.client.name}</span>
        </span>
        <FmtSwitch fmt={slot.appt.format} onToggle={() => setFmt.mutate(slot.appt!.format === "online" ? "offline" : "online")} />
        <button onClick={() => setResch(true)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-black">Перенести</button>
        {/* Отмена снимает запись, но окно остаётся свободным — не удаляем его. */}
        {!slot.past && <button onClick={() => cancel.mutate()} className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-black" style={{ background: "var(--salmon-soft)", color: "var(--salmon-edge)" }}>Освободить</button>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <p className="mr-auto text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">Кого записать?</p>
        <FmtSwitch fmt={slot.fmt} onToggle={() => setFmt.mutate(slot.fmt === "online" ? "offline" : "online")} />
        <button onClick={() => closeWin.mutate()} className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-black" style={{ background: "var(--salmon-soft)", color: "var(--salmon-edge)" }}>Удалить окно</button>
      </div>
      <ClientChips onPick={(id) => book.mutate({ clientId: id, format: slot.fmt })} />
    </div>
  );
}
