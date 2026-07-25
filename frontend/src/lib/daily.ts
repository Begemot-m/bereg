import type { Mood } from "@/lib/clients";
import type { GoodNote } from "@/lib/therapy";

// Две ежедневные опоры. Настроение отвечает «как я», заметка — «что было хорошего»:
// вместе они дают и фон дня, и то, на что можно опереться.
export const DAILY_TOTAL = 2;

export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type DayState = { key: string; date: Date; mood: boolean; good: boolean; done: boolean };

export function buildDays(moods: Mood[], notes: GoodNote[], count = 7): DayState[] {
  const moodKeys = new Set(moods.map((m) => dayKey(new Date(m.date))));
  const noteKeys = new Set(notes.filter((n) => n.text.trim()).map((n) => dayKey(new Date(n.date))));
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days: DayState[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const date = new Date(today);
    date.setDate(today.getDate() - back);
    const key = dayKey(date);
    const mood = moodKeys.has(key);
    const good = noteKeys.has(key);
    days.push({ key, date, mood, good, done: mood && good });
  }
  return days;
}

export function todayState(moods: Mood[], notes: GoodNote[]): DayState {
  const days = buildDays(moods, notes, 1);
  return days[0];
}

/**
 * Серия закрытых дней. Незакрытый сегодняшний день серию не рвёт (он ещё идёт),
 * и один пропуск прощается — обрывает только второй подряд. В приложении про
 * состояние обнулять всё за один тяжёлый день — плохая идея.
 */
export function streak(moods: Mood[], notes: GoodNote[]): { days: number; forgiven: boolean } {
  const history = buildDays(moods, notes, 120);
  let days = 0;
  let forgiven = false;
  let skipUsed = false;
  for (let i = history.length - 1; i >= 0; i--) {
    const day = history[i];
    if (day.done) { days += 1; continue; }
    if (i === history.length - 1) continue;
    // Подпись про прощённый день нужна, только если он свежий — иначе это шум.
    if (!skipUsed) { skipUsed = true; forgiven = days > 0 && history.length - 1 - i <= 2; continue; }
    break;
  }
  return { days, forgiven };
}

export function goodFor(notes: GoodNote[], date = new Date()): string {
  const key = dayKey(date);
  return notes.find((n) => dayKey(new Date(n.date)) === key)?.text ?? "";
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
