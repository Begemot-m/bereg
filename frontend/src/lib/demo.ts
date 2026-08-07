// Демо-режим: приложение работает без бэкенда, на мок-данных в localStorage.
// Включается переменной NEXT_PUBLIC_DEMO=1 (команда `bun run demo`).

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

type Status = "therapy" | "new" | "paused";
type HwStatus = "assigned" | "doing" | "done";
// Подключение клиента: none — карточку завёл психолог; invited — приглашение отправлено;
// joined — клиент зашёл, залогинился и подключил свой профиль (карточка синхронизирована).
type LinkState = "none" | "invited" | "joined";

type Client = {
  id: number;
  name: string;
  contact: string | null;
  note: string;
  status: Status;
  link: LinkState;
  invitedAt: string | null;
  notesModuleEnabled: boolean;
  notesModuleShared: boolean;
  notesModulePsychologist: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApptFormat = "online" | "offline";
type Appointment = {
  id: number;
  clientId: number;
  startsAt: string;
  durationMin: number;
  status: "scheduled" | "done" | "cancelled";
  note: string;
  format: ApptFormat;
  client: { id: number; name: string };
};

type Homework = { id: number; clientId: number; text: string; status: HwStatus; sentAt: string };
type Mood = { date: string; mood: number; emotions?: string[] }; // 1..5 + отмеченные состояния
type SessionReflection = { appointmentId: number; startsAt: string; status: string; therapistName: string; preparation: string; takeaway: string; feeling: number | null; updatedAt: string };
type WheelResult = { answers: Record<string, number[]>; completedAt: string };
type Support = { id: number; kind: string; text: string; createdAt: string };
type NotifRole = "psychologist" | "client";
type Notif = { id: number; forRole: NotifRole; kind: string; text: string; createdAt: string; read: boolean };

// Окно приёма: время начала + длительность (мин) + формат (онлайн/очно)
type WorkSlot = { t: string; d: number; fmt: ApptFormat };
type WorkHours = {
  // По дням недели (0=Пн..6=Вс)
  hours: Record<number, WorkSlot[]>;
  sessionMinutes: number;
  cancelLockDays?: number;
};

// Корректировки конкретных дат поверх шаблона: убрать окно / сменить формат
type SlotOverride = { removed?: boolean; fmt?: ApptFormat };

type DB = {
  seq: number;
  clients: Client[];
  appts: Appointment[];
  homework: Homework[];
  moods: Record<number, Mood[]>;
  goodNotes: Record<number, { date: string; text: string }[]>;
  board: Record<number, string>;
  wheel: Record<number, WheelResult | null>;
  therapyTutorialSeen: boolean;
  reflections: Record<number, SessionReflection[]>;
  myBookings: { id: number; psyName: string; startsAt: string; durationMin: number; format: ApptFormat }[];
  work: WorkHours;
  overrides: Record<string, SlotOverride>;
  support: Support[];
  notifications: Notif[];
  accountEmail: { email: string; verified: boolean } | null;
  reminderSettings: { reminder2h: boolean };
  sub: {
    status: "free" | "trial" | "active" | "pending" | "expired";
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    pro: boolean;
    pendingPlan: "pro" | null;
    pendingSince: number | null;
  };
};

const KEY = "psy_demo_db_v12";

function iso(daysFromNow: number, hour = 12, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function seed(): DB {
  const now = new Date().toISOString();
  // Демо стартует чистым: два клиента, ни одной записи, пустые статистика,
  // настроение, домашки и колесо баланса — всё наполняется руками.
  const clients: Client[] = [
    { id: 1, name: "Марина Соколова", contact: "@marina", note: "", status: "new", link: "none", invitedAt: null, notesModuleEnabled: false, notesModuleShared: true, notesModulePsychologist: false, createdAt: now, updatedAt: now },
    { id: 2, name: "Дмитрий Орлов", contact: "@dmitry_orlov", note: "", status: "new", link: "none", invitedAt: null, notesModuleEnabled: false, notesModuleShared: true, notesModulePsychologist: false, createdAt: now, updatedAt: now },
  ];
  const appts: Appointment[] = [];
  const homework: Homework[] = [];
  const moods: Record<number, Mood[]> = {};
  const goodNotes: Record<number, { date: string; text: string }[]> = {};
  const wheel: Record<number, WheelResult | null> = {};
  const reflections: Record<number, SessionReflection[]> = {};
  return {
    seq: 100,
    clients,
    appts,
    homework,
    moods,
    goodNotes,
    board: {},
    wheel,
    therapyTutorialSeen: false,
    reflections,
    myBookings: [],
    // Без рабочих часов записывать клиента некуда — в демо шаблон недели
    // задан сразу, и времена демо-сессий совпадают с окнами.
    work: {
      hours: {
        0: [{ t: "11:00", d: 50, fmt: "online" }, { t: "13:00", d: 50, fmt: "online" }, { t: "16:00", d: 50, fmt: "offline" }, { t: "18:00", d: 50, fmt: "online" }],
        1: [{ t: "11:00", d: 50, fmt: "online" }, { t: "13:00", d: 50, fmt: "online" }, { t: "16:00", d: 50, fmt: "offline" }, { t: "18:00", d: 50, fmt: "online" }],
        2: [{ t: "11:00", d: 50, fmt: "online" }, { t: "13:00", d: 50, fmt: "online" }, { t: "18:00", d: 50, fmt: "online" }],
        3: [{ t: "11:00", d: 50, fmt: "online" }, { t: "13:00", d: 50, fmt: "online" }, { t: "16:00", d: 50, fmt: "offline" }, { t: "18:00", d: 50, fmt: "online" }],
        4: [{ t: "11:00", d: 50, fmt: "online" }, { t: "13:00", d: 50, fmt: "online" }, { t: "16:00", d: 50, fmt: "offline" }],
      },
      sessionMinutes: 50,
    },
    overrides: {},
    support: [],
    notifications: [
      { id: 90, forRole: "psychologist", kind: "system", text: "Добро пожаловать в «Хронику». Здесь появляются отмены и переносы сессий.", createdAt: iso(-1, 9, 0), read: false },
      { id: 91, forRole: "client", kind: "system", text: "Добро пожаловать. Здесь будут напоминания и изменения по вашим сессиям.", createdAt: iso(-1, 9, 0), read: false },
    ],
    accountEmail: null,
    reminderSettings: { reminder2h: false },
    // Демо стартует на бесплатном тарифе — виден лимит 3 клиента и пейволл PRO.
    sub: { status: "free", trialEndsAt: null, currentPeriodEnd: null, pro: false, pendingPlan: null, pendingSince: null },
  };
}

function load(): DB {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      // Страховка от неполных/старых данных.
      const s = seed();
      // Пустой шаблон недели остался у тех, кто открывал демо до появления
      // расписания по умолчанию: без окон запись клиента не работает.
      if (!db.work?.hours || Object.keys(db.work.hours).length === 0) db.work = s.work;
      // миграция окон: старый формат — массив строк времени; добавляем fmt
      for (const k of Object.keys(db.work.hours)) {
        const arr = db.work.hours[Number(k)] as unknown[];
        if (Array.isArray(arr) && typeof arr[0] === "string") {
          db.work.hours[Number(k)] = (arr as unknown as string[]).map((t) => ({ t, d: db.work.sessionMinutes, fmt: "online" as ApptFormat }));
        } else if (Array.isArray(arr)) {
          db.work.hours[Number(k)] = (arr as WorkSlot[]).map((s) => ({ ...s, fmt: s.fmt ?? ("online" as ApptFormat) }));
        }
      }
      if (!db.myBookings) db.myBookings = s.myBookings;
      if (!db.moods) db.moods = s.moods;
      if (!db.goodNotes) db.goodNotes = s.goodNotes;
      if (!db.board) db.board = s.board;
      if (!db.wheel) db.wheel = s.wheel;
      // Форма подписки сменилась на единый PRO: у старых снимков вместо `pro`
      // лежали tools/promo/clientPro — такие сбрасываем на бесплатный тариф.
      if (!db.sub || db.sub.pro === undefined) db.sub = s.sub;
      if (!db.notifications) db.notifications = s.notifications;
      if (db.therapyTutorialSeen === undefined) db.therapyTutorialSeen = false;
      if (!db.reflections) db.reflections = s.reflections;
      if (!db.overrides) db.overrides = {};
      if (db.accountEmail === undefined) db.accountEmail = null;
      if (!db.reminderSettings) db.reminderSettings = s.reminderSettings;
      if (db.work.sessionMinutes === 60) db.work.sessionMinutes = 50;
      // миграция: подключение клиента — активные считаем уже присоединившимися
      for (const c of db.clients) {
        if (c.notesModuleEnabled === undefined) c.notesModuleEnabled = Boolean(db.reflections?.[c.id]?.length);
        if (c.notesModuleShared === undefined) c.notesModuleShared = true;
        if (c.notesModulePsychologist === undefined) c.notesModulePsychologist = Boolean(db.reflections?.[c.id]?.length);
        if (c.link === undefined) { c.link = c.status === "new" ? "none" : "joined"; c.invitedAt = null; }
      }
      return db;
    }
  } catch {
    /* ignore */
  }
  const db = seed();
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

function save(db: DB) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(db));
}

// Экспорт локальных данных приложения (кабинет → приватность): всё, что хранит демо.
export function exportLocalData(): string {
  if (typeof window === "undefined") return "{}";
  const dump: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("psy_") || k.startsWith("bereg") || k.startsWith("notify:") || k.startsWith("quiet:")) {
      const raw = localStorage.getItem(k) as string;
      try { dump[k] = JSON.parse(raw); } catch { dump[k] = raw; }
    }
  }
  return JSON.stringify({ app: "Хроника", exportedAt: new Date().toISOString(), data: dump }, null, 2);
}

// Сброс демо-данных к исходному состоянию (клиенты, записи, настроение и т.д.).
export function resetLocalData() {
  if (typeof window === "undefined") return;
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key));
  for (const key of keys) {
    if (key.startsWith("psy_") || key.startsWith("bereg") || key.startsWith("notify:") || key.startsWith("quiet:")) localStorage.removeItem(key);
  }
}

const fmtWhen = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
function notify(db: DB, forRole: NotifRole, kind: string, text: string) {
  db.notifications.push({ id: ++db.seq, forRole, kind, text, createdAt: new Date().toISOString(), read: false });
}

// Те же правила, что в lib/server/access.ts: пробный PRO идёт 14 дней от первой
// проведённой сессии, каталог бесплатен 14 дней после одобрения анкеты.
const TRIAL_DAYS = 14;
const CATALOG_FREE_DAYS = 14;
const addDays = (from: number, days: number) => new Date(from + days * 86_400_000);

/** Момент первой проведённой сессии — с него стартует триал. */
function firstSessionAt(db: DB): number | null {
  const now = Date.now();
  const past = db.appts
    .filter((a) => a.status !== "cancelled" && new Date(a.startsAt).getTime() <= now)
    .map((a) => new Date(a.startsAt).getTime())
    .sort((a, b) => a - b);
  return past[0] ?? null;
}

/**
 * Когда анкету одобрили. В демо модерация проходит сама через 6 секунд после
 * подачи; если записи о верификации нет — это готовая демо-практика, считаем
 * её одобренной только что, чтобы бесплатные 14 дней были видны в работе.
 */
function approvedAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("psy_verification");
  if (!raw) return Date.now();
  const v = JSON.parse(raw) as { status?: string; submittedAt?: string | null };
  if (!v.submittedAt) return null;
  const submitted = new Date(v.submittedAt).getTime();
  if (v.status === "approved") return submitted;
  return Date.now() - submitted > 6000 ? submitted : null;
}

function resolveSub(db: DB) {
  const s = db.sub;
  const now = Date.now();
  // Оплата «подтверждается» через ~2.5с после возврата с ЮKassa.
  if (s.status === "pending" && s.pendingSince && now - s.pendingSince > 2500) {
    s.status = "active";
    s.pro = true;
    s.currentPeriodEnd = addDays(now, 30).toISOString();
    s.trialEndsAt = null;
    s.pendingPlan = null;
    s.pendingSince = null;
    save(db);
  }

  if (s.status === "pending" || s.status === "active") return;

  // Подписки нет: считаем триал от первой сессии.
  const started = firstSessionAt(db);
  const trialEndsAt = started === null ? null : addDays(started, TRIAL_DAYS);
  const trialActive = Boolean(trialEndsAt && trialEndsAt.getTime() > now);
  const nextStatus = trialActive ? "trial" : started === null ? "free" : "expired";
  const nextEnds = trialActive ? trialEndsAt!.toISOString() : null;
  if (s.status !== nextStatus || s.trialEndsAt !== nextEnds || s.pro !== trialActive) {
    s.status = nextStatus;
    s.trialEndsAt = nextEnds;
    s.pro = trialActive;
    save(db);
  }
}

/** Ответ /subscription в демо: подписка + окно бесплатного каталога. */
function subPayload(db: DB) {
  const approved = approvedAt();
  const catalogUntil = approved === null ? null : addDays(approved, CATALOG_FREE_DAYS);
  const { status, trialEndsAt, currentPeriodEnd, pro, pendingPlan } = db.sub;
  return {
    status,
    trialEndsAt,
    trialStarted: firstSessionAt(db) !== null,
    currentPeriodEnd,
    pro,
    catalog: pro || Boolean(catalogUntil && catalogUntil.getTime() > Date.now()),
    catalogUntil: catalogUntil?.toISOString() ?? null,
    pendingPlan,
  };
}

// Демо-симуляция: спустя ~6с после приглашения клиент «заходит и подключает профиль».
// В боевом режиме это делает реальный вход клиента по ссылке-приглашению.
function resolveClientLinks(db: DB) {
  let changed = false;
  for (const c of db.clients) {
    if (c.link === "invited" && c.invitedAt && Date.now() - new Date(c.invitedAt).getTime() > 6000) {
      c.link = "joined";
      c.updatedAt = new Date().toISOString();
      notify(db, "psychologist", "join", `«${c.name}»: профиль подключён — карточка синхронизирована`);
      changed = true;
    }
  }
  if (changed) save(db);
}

function withStats(db: DB, c: Client) {
  const doneAppts = db.appts.filter((a) => a.clientId === c.id && a.status === "done");
  const next = db.appts
    .filter((a) => a.clientId === c.id && a.status === "scheduled" && new Date(a.startsAt) > new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const last = [...doneAppts].sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
  const hw = db.homework.filter((h) => h.clientId === c.id);
  return {
    ...c,
    sessionsDone: doneAppts.length,
    hoursDone: Math.round((doneAppts.reduce((s, a) => s + a.durationMin, 0) / 60) * 10) / 10,
    nextAt: next?.startsAt ?? null,
    lastAt: last?.startsAt ?? null,
    hwTotal: hw.length,
    hwDone: hw.filter((h) => h.status === "done").length,
  };
}

// Демо-расписание специалистов каталога: будни + суббота, разные форматы.
// Клиент видит именно эти окна при записи (свои часы психолога тут ни при чём).
const CATALOG_WORK: WorkHours = {
  sessionMinutes: 50,
  hours: {
    0: [{ t: "10:00", d: 50, fmt: "online" }, { t: "13:00", d: 50, fmt: "offline" }, { t: "18:00", d: 50, fmt: "online" }],
    1: [{ t: "11:00", d: 50, fmt: "online" }, { t: "16:00", d: 50, fmt: "online" }, { t: "19:00", d: 50, fmt: "offline" }],
    2: [{ t: "10:00", d: 50, fmt: "offline" }, { t: "14:00", d: 50, fmt: "online" }, { t: "17:00", d: 50, fmt: "online" }],
    3: [{ t: "12:00", d: 50, fmt: "online" }, { t: "15:00", d: 50, fmt: "online" }, { t: "18:30", d: 50, fmt: "offline" }],
    4: [{ t: "10:00", d: 50, fmt: "online" }, { t: "13:00", d: 50, fmt: "online" }, { t: "16:00", d: 50, fmt: "offline" }],
    5: [{ t: "11:00", d: 50, fmt: "online" }, { t: "13:00", d: 50, fmt: "online" }],
  },
};

// Занятый интервал: начало записи и её длительность. Один в один с сервером
// (lib/server/schedule.ts) — иначе демо и прод расходятся в занятости.
type Busy = { start: string; minutes: number };

// Занятость психолога (его сессии) либо самого пользователя-клиента.
const busyOf = (db: DB, isClient: boolean): Busy[] =>
  isClient
    ? db.myBookings.map((b) => ({ start: b.startsAt, minutes: b.durationMin }))
    : db.appts.filter((a) => a.status !== "cancelled").map((a) => ({ start: a.startsAt, minutes: a.durationMin }));

// Вычислить свободные слоты на дату из выбранных часов минус занятые времена.
function slotsFor(work: WorkHours, dateStr: string, busy: Busy[], overrides: Record<string, SlotOverride>): { start: string; taken: boolean; fmt: ApptFormat }[] {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return [];
  const wd = (d.getDay() + 6) % 7;
  const slots = [...((work.hours ?? {})[wd] ?? [])].sort((a, b) => a.t.localeCompare(b.t));
  const session = work.sessionMinutes || 50;
  // Запись занимает окно и тогда, когда её время не совпадает с шаблоном
  // минута в минуту.
  const ranges = busy
    .map((b) => { const from = new Date(b.start).getTime(); return [from, from + (b.minutes || session) * 60000] as [number, number]; })
    .filter(([from]) => !Number.isNaN(from));
  const now = Date.now();
  const out: { start: string; taken: boolean; fmt: ApptFormat }[] = [];
  for (const s of slots) {
    const [hh, mm] = s.t.split(":").map(Number);
    const t = new Date(d); t.setHours(hh, mm, 0, 0);
    if (t.getTime() < now) continue;
    const iso = t.toISOString();
    const ov = overrides[iso];
    if (ov?.removed) continue; // окно снято на эту дату
    const from = t.getTime();
    const to = from + (s.d || session) * 60000;
    out.push({ start: iso, taken: ranges.some(([bs, be]) => bs < to && from < be), fmt: ov?.fmt ?? s.fmt ?? "online" });
  }
  return out;
}

// Небольшая задержка, чтобы демо вело себя как сеть. 150 мс на каждый запрос
// складывались в заметные подвисания, когда экран тянет по 3-4 запроса сразу.
const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 40));

// Тот же гейт, что на сервере (lib/server/access.ts): пока анкета не одобрена,
// клиентов брать нельзя. Статус читаем напрямую из localStorage — импорт из
// psy-verification.ts замкнул бы круг, там demo.ts уже импортируется.
const APPROVED_ONLY = JSON.stringify({
  error: "not_approved",
  message: "Принимать клиентов можно после подтверждения анкеты. Заявка на верификацию — в кабинете.",
});

function demoApproved(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem("psy_verification");
  // Нет записи — демо-психолог с готовой практикой, права полные
  // (то же правило, что в psy-verification.ts).
  if (!raw) return true;
  const v = JSON.parse(raw) as { status?: string; submittedAt?: string | null };
  // Демо-модерация одобряет сама через несколько секунд после подачи; здесь
  // повторяем то же правило, иначе гейт спорил бы с экраном «на проверке».
  if (v.status === "approved") return true;
  return v.status === "review" && Boolean(v.submittedAt) && Date.now() - new Date(v.submittedAt!).getTime() > 6000;
}

const WEB_GUEST_KEY = "bereg_demo_web";
/** Код, которым в демо открывается вход по почте: писем тут никто не шлёт. */
export const DEMO_EMAIL_CODE = "000000";

/**
 * В демо человек всегда «внутри Telegram» и всегда авторизован, поэтому
 * лендинг и вход из браузера иначе не пощупать. Флаг ставится ссылкой
 * `?web=1`, снимается `?web=0` и удачным входом.
 */
export function isDemoWebGuest(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("web");
  if (q === "1") localStorage.setItem(WEB_GUEST_KEY, "1");
  if (q === "0") localStorage.removeItem(WEB_GUEST_KEY);
  return localStorage.getItem(WEB_GUEST_KEY) === "1";
}

export function leaveDemoWebGuest() {
  localStorage.removeItem(WEB_GUEST_KEY);
}

export async function mockFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const db = load();
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
  const clean = path.split("?")[0];
  const q = new URLSearchParams(path.split("?")[1] ?? "");

  if (clean === "/auth/email/request") return delay(({ ok: true }) as T);

  if (clean === "/auth/email/verify") {
    const code = String(body.code ?? "").replace(/\D/g, "");
    if (code !== DEMO_EMAIL_CODE) throw new Error("Неверный код");
    return delay(({ ok: true }) as T);
  }

  if (clean === "/my/email") {
    if (method === "GET") return delay(({ email: db.accountEmail?.email ?? null, verified: Boolean(db.accountEmail?.verified), canConfirm: Boolean(db.accountEmail && !db.accountEmail.verified) }) as T);
    if (method === "PUT") {
      const email = String(body.email ?? "").trim().toLowerCase();
      db.accountEmail = { email, verified: false };
      save(db);
      return delay(({ email, verified: false, canConfirm: true, message: "Ссылка для подтверждения отправлена на почту" }) as T);
    }
    if (method === "POST" && db.accountEmail) {
      db.accountEmail.verified = true;
      save(db);
      return delay(({ email: db.accountEmail.email, verified: true }) as T);
    }
    if (method === "DELETE") {
      db.accountEmail = null;
      save(db);
      return delay(undefined as T);
    }
  }

  if (clean === "/my/reminders") {
    if (method === "GET") return delay(({ reminder24h: true, reminder2h: db.reminderSettings.reminder2h }) as T);
    if (method === "PUT") {
      db.reminderSettings.reminder2h = Boolean(body.reminder2h);
      save(db);
      return delay(({ reminder24h: true, reminder2h: db.reminderSettings.reminder2h }) as T);
    }
  }

  // clients
  if (clean === "/clients" && method === "GET") {
    resolveClientLinks(db);
    const list = [...db.clients].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((c) => withStats(db, c));
    return delay(list as T);
  }
  if (clean === "/clients" && method === "POST") {
    if (!demoApproved()) throw new Error(`API 403: ${APPROVED_ONLY}`);
    const now = new Date().toISOString();
    const c: Client = {
      id: ++db.seq,
      name: String(body.name ?? ""),
      contact: (body.contact as string) || null,
      note: "",
      status: (body.status as Status) ?? "new",
      link: "none",
      invitedAt: null,
      notesModuleEnabled: false,
      notesModuleShared: true,
      notesModulePsychologist: false,
      createdAt: now,
      updatedAt: now,
    };
    db.clients.push(c);
    save(db);
    return delay(withStats(db, c) as T);
  }
  // приглашение клиента подключить свой профиль
  const inviteId = clean.match(/^\/clients\/(\d+)\/invite$/)?.[1];
  if (inviteId && method === "POST") {
    const c = db.clients.find((x) => x.id === Number(inviteId));
    if (!c) throw new Error("API 404");
    if (!demoApproved()) throw new Error(`API 403: ${APPROVED_ONLY}`);
    if (body.contact !== undefined) c.contact = (body.contact as string) || null;
    c.link = "invited";
    c.invitedAt = new Date().toISOString();
    c.updatedAt = c.invitedAt;
    save(db);
    return delay(withStats(db, c) as T);
  }
  const cid = clean.match(/^\/clients\/(\d+)$/)?.[1];
  if (cid) {
    const id = Number(cid);
    const c = db.clients.find((x) => x.id === id);
    if (!c) throw new Error("API 404");
    if (method === "GET") { resolveClientLinks(db); return delay(withStats(db, c) as T); }
    if (method === "PATCH") {
      if (body.name !== undefined) c.name = String(body.name);
      if (body.contact !== undefined) c.contact = (body.contact as string) || null;
      if (body.note !== undefined) c.note = String(body.note);
      if (body.status !== undefined) c.status = body.status as Status;
      c.updatedAt = new Date().toISOString();
      save(db);
      return delay(withStats(db, c) as T);
    }
    if (method === "DELETE") {
      db.clients = db.clients.filter((x) => x.id !== id);
      db.appts = db.appts.filter((a) => a.clientId !== id);
      db.homework = db.homework.filter((h) => h.clientId !== id);
      delete db.reflections[id];
      save(db);
      return delay(undefined as T);
    }
  }

  // moods клиента (как он живёт между сессиями)
  const moodClient = clean.match(/^\/clients\/(\d+)\/moods$/)?.[1];
  if (moodClient && method === "GET") {
    return delay((db.moods[Number(moodClient)] ?? []) as T);
  }

  const therapyClient = clean.match(/^\/clients\/(\d+)\/therapy$/)?.[1];
  if (therapyClient) {
    const id = Number(therapyClient);
    const client = db.clients.find((item) => item.id === id);
    if (!client) throw new Error("API 404");
    if (method === "PATCH") {
      const enabled = Boolean(body.notesModuleEnabled);
      client.notesModulePsychologist = enabled;
      if (enabled) {
        client.notesModuleEnabled = true;
      }
      save(db);
    }
    if (method === "GET" || method === "PATCH") {
      const visible = client.notesModulePsychologist && client.notesModuleShared;
      return delay({ moods: db.moods[id] ?? [], notes: db.goodNotes[id] ?? [], board: db.board[id] ?? "", wheel: db.wheel[id] ?? null, tutorialSeen: true, reflections: visible ? db.reflections[id] ?? [] : [], notesModule: { enabled: client.notesModuleEnabled, shared: client.notesModuleShared, psychologistEnabled: client.notesModulePsychologist } } as T);
    }
  }

  if (clean === "/my/therapy") {
    const id = 1;
    if (method === "PATCH") {
      if (body.mood !== undefined || body.emotions !== undefined) {
        const today = new Date(); today.setHours(12, 0, 0, 0);
        const key = today.toISOString().slice(0, 10);
        const entries = db.moods[id] ?? [];
        const found = entries.find((entry) => entry.date.slice(0, 10) === key);
        const target = found ?? { date: today.toISOString(), mood: 3 };
        if (body.mood !== undefined) target.mood = Math.min(5, Math.max(1, Number(body.mood)));
        if (Array.isArray(body.emotions)) target.emotions = (body.emotions as unknown[]).map(String).slice(0, 12);
        if (!found) entries.push(target);
        db.moods[id] = entries.slice(-30);
      }
      if (typeof body.good === "string") {
        const today = new Date(); today.setHours(12, 0, 0, 0);
        const key = today.toISOString().slice(0, 10);
        const text = String(body.good).trim().slice(0, 240);
        const notes = (db.goodNotes[id] ?? []).filter((n) => n.date.slice(0, 10) !== key);
        if (text) notes.push({ date: today.toISOString(), text });
        db.goodNotes[id] = notes.slice(-60);
      }
      if (typeof body.board === "string") db.board[id] = String(body.board).slice(0, 4000);
      if (body.wheel && typeof body.wheel === "object") {
        const clean: Record<string, number[]> = {};
        for (const [k, arr] of Object.entries(body.wheel as Record<string, number[]>)) clean[k] = arr.map((v) => Math.min(10, Math.max(0, Number(v))));
        db.wheel[id] = { answers: clean, completedAt: new Date().toISOString() };
      }
      if (body.tutorialSeen !== undefined) db.therapyTutorialSeen = Boolean(body.tutorialSeen);
      if (body.notesModule && typeof body.notesModule === "object") {
        const input = body.notesModule as Record<string, unknown>;
        const client = db.clients.find((item) => item.id === id);
        if (client) {
          if (input.enabled !== undefined) client.notesModuleEnabled = Boolean(input.enabled);
          if (input.shared !== undefined) client.notesModuleShared = Boolean(input.shared);
        }
      }
      if (body.reflection && typeof body.reflection === "object") {
        const input = body.reflection as Record<string, unknown>;
        const appointmentId = Number(input.appointmentId);
        const booking = db.myBookings.find((item) => item.id === appointmentId);
        const client = db.clients.find((item) => item.id === id);
        if (booking && client?.notesModuleEnabled) {
          const entries = db.reflections[id] ?? [];
          const found = entries.find((item) => item.appointmentId === appointmentId);
          const target: SessionReflection = found ?? { appointmentId, startsAt: booking.startsAt, status: new Date(booking.startsAt) < new Date() ? "done" : "scheduled", therapistName: booking.psyName, preparation: "", takeaway: "", feeling: null, updatedAt: new Date().toISOString() };
          if (typeof input.preparation === "string") target.preparation = input.preparation.trim().slice(0, 2000);
          if (typeof input.takeaway === "string") target.takeaway = input.takeaway.trim().slice(0, 2000);
          if (input.feeling === null) target.feeling = null;
          else if (input.feeling !== undefined) target.feeling = Math.min(10, Math.max(1, Number(input.feeling)));
          target.updatedAt = new Date().toISOString();
          if (!found) entries.push(target);
          db.reflections[id] = entries.sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 30);
        }
      }
      save(db);
    }
    if (method === "GET" || method === "PATCH") {
      const client = db.clients.find((item) => item.id === id);
      return delay({ moods: db.moods[id] ?? [], notes: db.goodNotes[id] ?? [], board: db.board[id] ?? "", wheel: db.wheel[id] ?? null, tutorialSeen: db.therapyTutorialSeen, reflections: db.reflections[id] ?? [], notesModule: { enabled: client?.notesModuleEnabled ?? false, shared: client?.notesModuleShared ?? true, psychologistEnabled: client?.notesModulePsychologist ?? false } } as T);
    }
  }

  // homework
  const hwClient = clean.match(/^\/clients\/(\d+)\/homework$/)?.[1];
  if (hwClient) {
    const id = Number(hwClient);
    if (method === "GET") {
      const list = db.homework.filter((h) => h.clientId === id).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
      return delay(list as T);
    }
    if (method === "POST") {
      const h: Homework = {
        id: ++db.seq,
        clientId: id,
        text: String(body.text ?? ""),
        status: "assigned",
        sentAt: new Date().toISOString(),
      };
      db.homework.push(h);
      save(db);
      return delay(h as T);
    }
  }
  const hwId = clean.match(/^\/homework\/(\d+)$/)?.[1];
  if (hwId && method === "PATCH") {
    const h = db.homework.find((x) => x.id === Number(hwId));
    if (!h) throw new Error("API 404");
    if (body.text !== undefined) h.text = String(body.text);
    if (body.status !== undefined) {
      const becameDone = body.status === "done" && h.status !== "done";
      h.status = body.status as HwStatus;
      // Закрываем петлю: психолог видит в колокольчике, что клиент выполнил задание.
      if (becameDone) {
        const cl = db.clients.find((c) => c.id === h.clientId);
        notify(db, "psychologist", "system", `Задание выполнено${cl ? ` · ${cl.name}` : ""}: «${h.text.length > 40 ? h.text.slice(0, 40) + "…" : h.text}»`);
      }
    }
    save(db);
    return delay(h as T);
  }
  if (hwId && method === "DELETE") {
    db.homework = db.homework.filter((x) => x.id !== Number(hwId));
    save(db);
    return delay({ ok: true } as T);
  }

  // appointments (психолог)
  if (clean === "/appointments" && method === "GET") {
    const cf = q.get("clientId");
    let list = [...db.appts];
    if (cf) list = list.filter((a) => a.clientId === Number(cf));
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return delay(list as T);
  }
  if (clean === "/appointments" && method === "POST") {
    const cl = db.clients.find((x) => x.id === Number(body.clientId));
    if (!cl) throw new Error("API 404");
    if (!demoApproved()) throw new Error(`API 403: ${APPROVED_ONLY}`);
    const a: Appointment = {
      id: ++db.seq,
      clientId: cl.id,
      startsAt: new Date(String(body.startsAt)).toISOString(),
      durationMin: Number(body.durationMin ?? db.work.sessionMinutes ?? 50),
      status: "scheduled",
      note: "",
      format: (body.format as ApptFormat) ?? "online",
      client: { id: cl.id, name: cl.name },
    };
    db.appts.push(a);
    save(db);
    return delay(a as T);
  }
  const aid = clean.match(/^\/appointments\/(\d+)$/)?.[1];
  if (aid) {
    const id = Number(aid);
    const a = db.appts.find((x) => x.id === id);
    if (!a) throw new Error("API 404");
    if (method === "PATCH") {
      if (body.status === "cancelled") notify(db, "client", "cancel", `Психолог отменил сессию · ${fmtWhen(a.startsAt)}`);
      else if (body.startsAt !== undefined) notify(db, "client", "reschedule", `Психолог перенёс сессию на ${fmtWhen(new Date(String(body.startsAt)).toISOString())}`);
      if (body.status !== undefined) a.status = body.status as Appointment["status"];
      if (body.startsAt !== undefined) a.startsAt = new Date(String(body.startsAt)).toISOString();
      if (body.durationMin !== undefined) a.durationMin = Number(body.durationMin);
      if (body.format !== undefined) a.format = body.format as ApptFormat;
      save(db);
      return delay(a as T);
    }
    if (method === "DELETE") {
      db.appts = db.appts.filter((x) => x.id !== id);
      save(db);
      return delay(undefined as T);
    }
  }

  // рабочие окна психолога
  if (clean === "/work-hours" && method === "GET") return delay(db.work as T);
  if (clean === "/work-hours" && method === "PATCH") {
    if (body.hours) db.work.hours = body.hours as WorkHours["hours"];
    if (body.sessionMinutes) db.work.sessionMinutes = Number(body.sessionMinutes);
    if (body.cancelLockDays !== undefined) db.work.cancelLockDays = Number(body.cancelLockDays);
    save(db);
    return delay(db.work as T);
  }

  // свободные слоты на дату (psy=1 → клиентское бронирование к специалисту)
  if (clean === "/slots" && method === "GET") {
    const date = q.get("date")!;
    const isClient = q.get("psy") != null;
    const busy = busyOf(db, isClient);
    return delay(slotsFor(isClient ? CATALOG_WORK : db.work, date, busy, db.overrides) as T);
  }

  // корректировки конкретных дат (убрать окно / сменить формат)
  if (clean === "/overrides" && method === "GET") return delay(db.overrides as T);
  if (clean === "/overrides" && method === "PATCH") {
    const iso = String(body.iso);
    const cur = db.overrides[iso] ?? {};
    if (body.removed !== undefined) cur.removed = Boolean(body.removed);
    if (body.fmt !== undefined) cur.fmt = body.fmt as ApptFormat;
    db.overrides[iso] = cur;
    save(db);
    return delay(db.overrides as T);
  }

  // доступность по дням на ближайшие ~2 месяца: free (есть окна) / full (все заняты)
  if (clean === "/month-availability" && method === "GET") {
    const isClient = q.get("psy") != null;
    const busy = busyOf(db, isClient);
    const p = (n: number) => String(n).padStart(2, "0");
    const ymdOf = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    // День с записью занят, даже если рабочих часов на него не задано.
    const withAppt = new Set(busy.map((b) => ymdOf(new Date(b.start))));
    const out: Record<string, "free" | "full"> = {};
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 60; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i);
      const ymd = ymdOf(d);
      const slots = slotsFor(isClient ? CATALOG_WORK : db.work, ymd, busy, db.overrides);
      if (slots.length === 0) {
        if (withAppt.has(ymd)) out[ymd] = "full";
        continue;
      }
      out[ymd] = slots.some((s) => !s.taken) ? "free" : "full";
    }
    return delay(out as T);
  }

  // записи клиента-пользователя (его сессии у специалистов)
  if (clean === "/my/appointments" && method === "GET") {
    return delay([...db.myBookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) as T);
  }
  if (clean === "/my/appointments" && method === "POST") {
    const b = { id: ++db.seq, psyName: String(body.psyName ?? "Специалист"), startsAt: new Date(String(body.startsAt)).toISOString(), durationMin: Number(body.durationMin ?? db.work.sessionMinutes), format: (body.format as ApptFormat) ?? "online" };
    db.myBookings.push(b);
    save(db);
    return delay(b as T);
  }
  const myId = clean.match(/^\/my\/appointments\/(\d+)$/)?.[1];
  if (myId) {
    const id = Number(myId);
    const b = db.myBookings.find((x) => x.id === id);
    if (!b) throw new Error("API 404");
    if (method === "PATCH") {
      if (body.startsAt) b.startsAt = new Date(String(body.startsAt)).toISOString();
      notify(db, "psychologist", "reschedule", `Клиент перенёс сессию на ${fmtWhen(b.startsAt)}`);
      save(db);
      return delay(b as T);
    }
    if (method === "DELETE") {
      notify(db, "psychologist", "cancel", `Клиент отменил сессию · ${b.psyName} · ${fmtWhen(b.startsAt)}`);
      db.myBookings = db.myBookings.filter((x) => x.id !== id);
      save(db);
      return delay(undefined as T);
    }
  }

  // stats
  if (clean === "/stats" && method === "GET") {
    const days = Number(q.get("days") ?? 30);
    const from = new Date();
    from.setDate(from.getDate() - days);
    const inRange = db.appts.filter((a) => new Date(a.startsAt) >= from);
    const done = inRange.filter((a) => a.status === "done");
    return delay({
      periodDays: days,
      sessions: inRange.length,
      done: done.length,
      hours: Math.round(done.reduce((s, a) => s + a.durationMin, 0) / 60),
      clientsActive: db.clients.filter((c) => c.status === "therapy").length,
    } as T);
  }

  // subscription / billing
  if (clean === "/subscription" && method === "GET") {
    resolveSub(db);
    return delay(subPayload(db) as T);
  }
  if (clean === "/billing/subscribe" && method === "POST") {
    db.sub = { ...db.sub, status: "pending", pendingPlan: "pro", pendingSince: Date.now() };
    save(db);
    return delay({ confirmation_url: "/billing/return" } as T);
  }

  // переход в психологи: в демо роль живёт в localStorage, серверу подтверждать нечего
  if (clean === "/profile/role" && method === "POST") {
    return delay({ role: "psychologist" } as T);
  }

  // удаление своих сведений: в демо всё лежит на устройстве, его чистит
  // resetLocalData сразу после ответа — серверной части тут просто нет
  if (clean === "/my/data" && method === "DELETE") {
    return delay(undefined as T);
  }

  // support (отдел заботы)
  if (clean === "/support" && method === "POST") {
    const s: Support = { id: ++db.seq, kind: String(body.kind ?? "вопрос"), text: String(body.text ?? ""), createdAt: new Date().toISOString() };
    db.support.push(s);
    save(db);
    return delay(s as T);
  }

  // уведомления
  if (clean === "/notifications" && method === "GET") {
    const role = (q.get("role") === "psychologist" ? "psychologist" : "client") as NotifRole;
    const list = db.notifications.filter((n) => n.forRole === role).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(list as T);
  }
  if (clean === "/notifications/read" && method === "POST") {
    const role = (body.role === "psychologist" ? "psychologist" : "client") as NotifRole;
    db.notifications.forEach((n) => { if (n.forRole === role) n.read = true; });
    save(db);
    return delay({ ok: true } as T);
  }

  throw new Error(`Demo mock: не покрыт роут ${method} ${clean}`);
}
