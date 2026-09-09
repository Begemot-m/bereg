/**
 * Окно, выбранное до входа. Вход в вебе заканчивается перезагрузкой страницы,
 * и без этого человек возвращался в анкету заново искать своё время. Живёт до
 * конца вкладки: намерение записаться — не то, что стоит помнить неделями.
 */
const KEY = "bereg_booking_intent_v1";

export type BookingIntent = { psyId: number; iso: string; format: "online" | "offline" };

export function rememberBooking(intent: BookingIntent) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    // Приватный режим — тогда после входа человек выберет окно ещё раз.
  }
}

/** Ждёт ли запись по этой анкете — чтобы после входа блок записи был раскрыт. */
export function hasBooking(psyId: number): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BookingIntent).psyId === psyId : false;
  } catch {
    return false;
  }
}

/** Забрать намерение по этому специалисту: прочитали — и сразу выбросили. */
export function takeBooking(psyId: number): BookingIntent | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as BookingIntent;
    if (intent.psyId !== psyId) return null;
    sessionStorage.removeItem(KEY);
    // Пока человек входил, время могло пройти — такое окно не предлагаем.
    return new Date(intent.iso).getTime() > Date.now() ? intent : null;
  } catch {
    return null;
  }
}
