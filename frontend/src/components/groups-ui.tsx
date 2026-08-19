"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

import { ClientAvatar } from "@/components/client-avatar";
import { Icon } from "@/components/icons";
import { listClients } from "@/lib/clients";
import { useQuery } from "@tanstack/react-query";
import { activeMembers, type Group, type GroupMeeting } from "@/lib/groups";
import { tap } from "@/lib/haptics";

export const EDGE = "var(--salmon-edge)";
export const SOFT = "var(--salmon-soft)";

/**
 * Нижний лист модуля. Тот же жест, что у остальных листов приложения:
 * затемнение, пружина снизу, закрытие тапом по фону.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[85] flex items-end justify-center @md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-[rgba(32,28,24,.5)]" onClick={onClose} aria-label="Закрыть" />
          <motion.section
            role="dialog"
            aria-modal="true"
            initial={{ y: 28, opacity: 0.7 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[var(--surface)] @md:rounded-[28px]"
          >
            <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-4">
              <h2 className="font-tight text-[18px] font-black leading-tight">{title}</h2>
              <button onClick={() => { tap(); onClose(); }} className="ico h-8 w-8 shrink-0 keep-style" style={{ background: "var(--surface-2)" }} aria-label="Закрыть">
                <span className="text-[15px] font-black">×</span>
              </button>
            </div>
            <div className="overflow-y-auto px-4 pb-4 pt-2">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Действие в заголовке раздела — тот же вид, что «График» и «Календарь» в «Сессиях». */
export function SectionAction({ icon, label, onClick }: { icon: "plus" | "calendar"; label: string; onClick: () => void }) {
  return (
    <button onClick={() => { tap(); onClick(); }} className="inline-flex min-h-9 items-center gap-1.5 text-[12px] font-black" style={{ color: EDGE }}>
      <Icon name={icon} width={14} weight="bold" color={EDGE} />
      {label}
    </button>
  );
}

/** Лица состава стопкой: до четырёх, дальше счётчик. */
export function MemberStack({ group, size = 30 }: { group: Group; size?: number }) {
  const members = activeMembers(group);
  const shown = members.slice(0, 4);
  const rest = members.length - shown.length;
  if (!members.length) return <span className="text-[11px] font-bold text-[var(--muted-2)]">состав пуст</span>;
  return (
    <span className="flex items-center">
      {shown.map((m, i) => (
        <ClientAvatar
          key={m.id}
          name={m.name}
          photo={m.photo}
          className="keep-style rounded-full text-[11px] font-black"
          style={{ width: size, height: size, marginLeft: i ? -8 : 0, background: SOFT, color: EDGE, border: "2px solid #fff" }}
        />
      ))}
      {rest > 0 && (
        <span className="keep-style flex items-center justify-center rounded-full text-[10px] font-black" style={{ width: size, height: size, marginLeft: -8, background: EDGE, color: "#fff", border: "2px solid #fff" }}>
          +{rest}
        </span>
      )}
    </span>
  );
}

/** Список клиентов с отметками — им добирается состав группы. */
export function ClientPicker({ exclude, seats, onPick, busy }: { exclude: Set<number>; seats: number; onPick: (ids: number[]) => void; busy?: boolean }) {
  const clients = useQuery({ queryKey: ["clients"], queryFn: () => listClients() });
  const [picked, setPicked] = useState<number[]>([]);
  const free = (clients.data ?? []).filter((c) => !exclude.has(c.id));

  if (!free.length) {
    return <p className="py-4 text-center text-[12px] font-semibold text-[var(--muted)]">Все ваши клиенты уже в этой группе.</p>;
  }

  const full = picked.length >= seats;

  return (
    <>
      <p className="mb-2 text-[11px] font-bold text-[var(--muted)]">Свободных мест: {seats}</p>
      <div className="flex flex-col gap-1.5">
        {free.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => { tap(); setPicked((p) => (on ? p.filter((x) => x !== c.id) : full ? p : [...p, c.id])); }}
              disabled={!on && full}
              className="flex items-center gap-2.5 rounded-[13px] bg-white p-2.5 text-left disabled:opacity-45"
              style={{ border: `var(--bw) solid ${on ? EDGE : "var(--edge-neutral)"}` }}
            >
              <ClientAvatar name={c.name} photo={c.photo} className="keep-style h-9 w-9 rounded-full text-[12px] font-black" style={{ background: SOFT, color: EDGE }} />
              <span className="min-w-0 flex-1 text-[13px] font-black">{c.name}</span>
              <Tick on={on} />
            </button>
          );
        })}
      </div>
      <button onClick={() => { tap(); onPick(picked); }} disabled={!picked.length || busy} className="btn mt-3 w-full py-3">
        Добавить{picked.length ? ` · ${picked.length}` : ""}
      </button>
    </>
  );
}

export function Tick({ on }: { on: boolean }) {
  return (
    <span className="ico h-6 w-6 shrink-0 keep-style" style={{ background: on ? EDGE : "var(--surface-2)" }}>
      {on && <Icon name="check" width={12} weight="bold" color="#fff" />}
    </span>
  );
}

/**
 * Кто был на встрече. Отмечается одним проходом по составу: по умолчанию все
 * пришли — ведущему остаётся снять тех, кого не было.
 */
export function AttendanceForm({ group, meeting, onSave, busy }: { group: Group; meeting: GroupMeeting; onSave: (rows: { memberId: number; present: boolean }[]) => void; busy?: boolean }) {
  const members = activeMembers(group);
  const [absent, setAbsent] = useState<number[]>(() =>
    meeting.attendance.length ? meeting.attendance.filter((a) => !a.present).map((a) => a.memberId) : [],
  );

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {members.map((m) => {
          const on = !absent.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => { tap(); setAbsent((p) => (on ? [...p, m.id] : p.filter((x) => x !== m.id))); }}
              className="flex items-center gap-2.5 rounded-[13px] bg-white p-2.5 text-left"
              style={{ border: `var(--bw) solid ${on ? EDGE : "var(--edge-neutral)"}`, opacity: on ? 1 : 0.6 }}
            >
              <ClientAvatar name={m.name} photo={m.photo} className="keep-style h-9 w-9 rounded-full text-[12px] font-black" style={{ background: SOFT, color: EDGE }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black">{m.name}</span>
                <span className="block text-[10.5px] font-bold text-[var(--muted-2)]">{on ? "был" : "пропустил"}</span>
              </span>
              <Tick on={on} />
            </button>
          );
        })}
      </div>
      <button
        onClick={() => { tap(); onSave(members.map((m) => ({ memberId: m.id, present: !absent.includes(m.id) }))); }}
        disabled={busy}
        className="btn mt-3 w-full py-3"
      >
        Сохранить · пришли {members.length - absent.length} из {members.length}
      </button>
    </>
  );
}

/**
 * Планирование встреч. Одно и то же окно закрывает оба случая: разовая встреча
 * и цикл — группы почти всегда ходят по одному дню недели.
 */
export function PlanForm({ onPlan, busy }: { onPlan: (input: { startsAt: string; durationMin: number; repeatWeeks: number }) => void; busy?: boolean }) {
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [time, setTime] = useState("19:00");
  const [dur, setDur] = useState(90);
  const [weeks, setWeeks] = useState(8);

  const when = new Date(`${date}T${time}`);
  const dayName = ["воскресеньям", "понедельникам", "вторникам", "средам", "четвергам", "пятницам", "субботам"][when.getDay()] ?? "";

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Дата</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="tf mt-1 w-full" />
        </label>
        <label className="block">
          <span className="text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Время</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="tf mt-1 w-full" />
        </label>
      </div>

      <p className="mb-1 mt-3 text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Длительность</p>
      <div className="grid grid-cols-4 gap-1.5">
        {[50, 60, 90, 120].map((d) => (
          <button
            key={d}
            onClick={() => { tap(); setDur(d); }}
            className="rounded-[12px] py-2 text-[12px] font-black"
            style={dur === d ? { background: EDGE, color: "#fff" } : { background: "#fff", border: "var(--bw) solid var(--edge-neutral)" }}
          >
            {d} мин
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-[13px] bg-white p-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[13px] font-black">Повторять по неделям</span>
            <span className="block text-[10.5px] font-bold text-[var(--muted-2)]">
              {weeks > 1 ? `${weeks} встреч по ${dayName}` : "разовая встреча"}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <button onClick={() => { tap(); setWeeks((n) => Math.max(1, n - 1)); }} className="ico h-8 w-8 keep-style" style={{ background: SOFT }} aria-label="Меньше">
              <Icon name="close" width={13} weight="bold" color={EDGE} />
            </button>
            <span className="w-5 text-center text-[15px] font-black">{weeks}</span>
            <button onClick={() => { tap(); setWeeks((n) => Math.min(52, n + 1)); }} className="ico h-8 w-8 keep-style" style={{ background: SOFT }} aria-label="Больше">
              <Icon name="plus" width={13} weight="bold" color={EDGE} />
            </button>
          </span>
        </div>
      </div>

      <button
        onClick={() => { tap(); onPlan({ startsAt: when.toISOString(), durationMin: dur, repeatWeeks: weeks }); }}
        disabled={busy || Number.isNaN(+when)}
        className="btn mt-3 w-full py-3"
      >
        {weeks > 1 ? `Запланировать ${weeks} встреч` : "Запланировать встречу"}
      </button>
    </>
  );
}

/**
 * Посещаемость кольцом. Библиотек для графиков в проекте нет и заводить их
 * ради одного круга незачем: дуга рисуется одним `circle` с обводкой.
 */
export function AttendanceDonut({ rate, size = 84 }: { rate: number; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SOFT} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={EDGE}
          strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={len}
          initial={{ strokeDashoffset: len }}
          animate={{ strokeDashoffset: len * (1 - rate / 100) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum font-tight text-[20px] font-black leading-none">{rate}%</span>
      </span>
    </span>
  );
}

/** Переключатель на два положения — тот же вид, что у настроек напоминаний. */
export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button onClick={() => { tap(); onChange(!on); }} role="switch" aria-checked={on} className="flex w-full items-center gap-3 py-2.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-tight">{label}</span>
        {hint && <span className="block text-[10.5px] font-bold text-[var(--muted-2)]">{hint}</span>}
      </span>
      <span className="keep-style relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors" style={{ background: on ? EDGE : "var(--edge-neutral)" }}>
        <motion.span
          className="absolute top-[3px] h-5 w-5 rounded-full bg-white"
          animate={{ left: on ? 21 : 3 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      </span>
    </button>
  );
}

/** Вкладки карточки группы. */
export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: { id: T; label: string; badge?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-[14px] p-1" style={{ background: "var(--surface-2)" }}>
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => { tap(); onChange(t.id); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] py-2 text-[12.5px] font-black transition-colors"
            style={on ? { background: "#fff", color: "var(--ink)" } : { color: "var(--muted)" }}
          >
            {t.label}
            {typeof t.badge === "number" && t.badge > 0 && (
              <span className="keep-style rounded-full px-1.5 text-[10px] font-black" style={{ background: on ? SOFT : "transparent", color: on ? EDGE : "var(--muted-2)" }}>
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
