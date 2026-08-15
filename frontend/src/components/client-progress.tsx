"use client";

import { Icon, type IconName } from "@/components/icons";
import type { Homework, Mood, MyBooking } from "@/lib/clients";
import { addDays, zoneYmd } from "@/lib/zone";

/**
 * Серия отметок: сколько дней подряд человек отмечал настроение. Сегодняшний
 * день ещё не потерян — пока он не закончился, серию держит вчерашняя отметка,
 * иначе она «рвалась» бы каждое утро.
 */
export function moodStreak(moods: Mood[], now = new Date()): number {
  const days = new Set(moods.map((m) => zoneYmd(new Date(m.date))));
  const today = zoneYmd(now);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
};

/**
 * Свой итог у клиента. Раньше вся его статистика была одной свёрнутой
 * динамикой настроения: возвращаться в приложение было не за чем, хотя данные
 * для «у меня получается» уже собирались.
 */
export function ClientProgress({ moods, meetings, homework }: { moods: Mood[]; meetings: MyBooking[]; homework: Homework[] }) {
  const streak = moodStreak(moods);
  const now = Date.now();
  const held = meetings.filter((m) => new Date(m.startsAt).getTime() + m.durationMin * 60_000 < now).length;
  const doneHw = homework.filter((h) => h.status === "done").length;

  if (streak === 0 && held === 0 && homework.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      <Cell
        icon="mood"
        tone="purple"
        value={streak > 0 ? String(streak) : "—"}
        label={streak > 0 ? `${plural(streak, "день", "дня", "дней")} подряд` : "отметьте настроение"}
      />
      <Cell icon="calendar" tone="green" value={String(held)} label={`${plural(held, "встреча", "встречи", "встреч")} пройдено`} />
      <Cell
        icon="check"
        tone="amber"
        value={homework.length ? `${doneHw}/${homework.length}` : "—"}
        label={homework.length ? "заданий выполнено" : "заданий пока нет"}
      />
    </div>
  );
}

function Cell({ icon, value, label, tone }: { icon: IconName; value: string; label: string; tone: "green" | "amber" | "purple" }) {
  return (
    <div className="card-soft relative p-2.5 pt-3" style={{ background: `var(--${tone}-soft)` }}>
      <Icon name={icon} width={14} weight="bold" className="absolute right-2.5 top-2.5 opacity-60" color={`var(--${tone}-edge)`} />
      <p className="font-tight tabular-nums text-[26px] font-black leading-none">{value}</p>
      <p className="mt-1.5 text-[8.5px] font-black uppercase leading-tight tracking-[.04em] text-[var(--muted)]">{label}</p>
    </div>
  );
}
