// Демо-режим: приложение работает без бэкенда, на мок-данных в localStorage.
// Включается переменной NEXT_PUBLIC_DEMO=1 (команда `bun run demo`).

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

type Status = "therapy" | "new" | "paused";
type HwStatus = "assigned" | "doing" | "done";

type Client = {
  id: number;
  name: string;
  contact: string | null;
  note: string;
  status: Status;
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
type Mood = { date: string; mood: number }; // 1..5
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
};

// Корректировки конкретных дат поверх шаблона: убрать окно / сменить формат
type SlotOverride = { removed?: boolean; fmt?: ApptFormat };

type DB = {
  seq: number;
  clients: Client[];
  appts: Appointment[];
  homework: Homework[];
  moods: Record<number, Mood[]>;
  wheel: Record<number, WheelResult | null>;
  therapyTutorialSeen: boolean;
  myBookings: { id: number; psyName: string; startsAt: string; durationMin: number; format: ApptFormat }[];
  work: WorkHours;
  overrides: Record<string, SlotOverride>;
  support: Support[];
  notifications: Notif[];
  sub: {
    status: "trial" | "active" | "pending" | "expired";
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    tools: boolean;
    promo: boolean;
    clientPro: boolean;
    pendingPlan: "tools" | "all" | "client" | null;
    pendingSince: number | null;
  };
};

const KEY = "psy_demo_db_v7";

function iso(daysFromNow: number, hour = 12, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function seed(): DB {
  const now = new Date().toISOString();
  const clients: Client[] = [
    { id: 1, name: "Марина Соколова", contact: "@marina", note: "Тревога, границы.", status: "therapy", createdAt: now, updatedAt: now },
    { id: 2, name: "Дмитрий Орлов", contact: "+7 916 220-14-08", note: "", status: "new", createdAt: now, updatedAt: now },
    { id: 3, name: "Алёна Ким", contact: "alena@mail.ru", note: "Выгорание, ресурс.", status: "therapy", createdAt: now, updatedAt: now },
    { id: 4, name: "Пётр Ланской", contact: "@plansky", note: "Пауза до осени по его инициативе.", status: "paused", createdAt: now, updatedAt: now },
  ];
  const appts: Appointment[] = [
    { id: 11, clientId: 1, startsAt: iso(0, 18, 0), durationMin: 60, status: "scheduled", note: "", format: "online", client: { id: 1, name: "Марина Соколова" } },
    { id: 12, clientId: 3, startsAt: iso(1, 11, 30), durationMin: 50, status: "scheduled", note: "", format: "offline", client: { id: 3, name: "Алёна Ким" } },
    { id: 13, clientId: 1, startsAt: iso(-7, 18, 0), durationMin: 60, status: "done", note: "", format: "online", client: { id: 1, name: "Марина Соколова" } },
    { id: 14, clientId: 1, startsAt: iso(-14, 18, 0), durationMin: 60, status: "done", note: "", format: "online", client: { id: 1, name: "Марина Соколова" } },
    { id: 15, clientId: 3, startsAt: iso(-6, 11, 30), durationMin: 50, status: "done", note: "", format: "offline", client: { id: 3, name: "Алёна Ким" } },
    { id: 16, clientId: 2, startsAt: iso(3, 13, 0), durationMin: 60, status: "scheduled", note: "", format: "online", client: { id: 2, name: "Дмитрий Орлов" } },
  ];
  const homework: Homework[] = [
    { id: 51, clientId: 1, text: "Дневник тревоги: 3 записи за неделю.", status: "done", sentAt: iso(-6, 19, 0) },
    { id: 52, clientId: 1, text: "Практика «5-4-3-2-1» при нарастании тревоги.", status: "doing", sentAt: iso(-2, 10, 0) },
    { id: 53, clientId: 3, text: "Список источников энергии — минимум 10 пунктов.", status: "assigned", sentAt: iso(-1, 12, 0) },
  ];
  const moods: Record<number, Mood[]> = {
    1: [3, 3, 2, 4, 3, 4, 4].map((m, i) => ({ date: day(i - 6), mood: m })),
    3: [2, 2, 3, 2, 3, 3, 2].map((m, i) => ({ date: day(i - 6), mood: m })),
  };
  const wheel: Record<number, WheelResult | null> = {
    1: null,
    3: { answers: {
      health: [6, 5, 6], emotions: [4, 3, 5], relationships: [7, 8, 7], family: [6, 6, 5],
      social: [5, 4, 5], work: [3, 3, 4], finance: [5, 5, 4], growth: [7, 6, 7],
      leisure: [4, 4, 5], environment: [6, 7, 6],
    }, completedAt: day(-4) },
  };
  return {
    seq: 100,
    clients,
    appts,
    homework,
    moods,
    wheel,
    therapyTutorialSeen: false,
    myBookings: [{ id: 71, psyName: "Ирина Верещагина", startsAt: iso(2, 17, 0), durationMin: 60, format: "online" }],
    work: {
      hours: {},
      sessionMinutes: 50,
    },
    overrides: {},
    support: [],
    notifications: [
      { id: 90, forRole: "psychologist", kind: "system", text: "Добро пожаловать во «Вдох». Здесь появляются отмены и переносы сессий.", createdAt: iso(-1, 9, 0), read: false },
      { id: 91, forRole: "client", kind: "system", text: "Добро пожаловать. Здесь будут напоминания и изменения по вашим сессиям.", createdAt: iso(-1, 9, 0), read: false },
    ],
    sub: { status: "trial", trialEndsAt: iso(10, 12, 0), currentPeriodEnd: null, tools: true, promo: false, clientPro: false, pendingPlan: null, pendingSince: null },
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
      if (!db.work?.hours) db.work = s.work;
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
      if (!db.wheel) db.wheel = s.wheel;
      if (!db.sub || (db.sub as { trialEndsAt?: string }).trialEndsAt === undefined) db.sub = s.sub;
      if (db.sub.clientPro === undefined) db.sub.clientPro = false;
      if (!db.notifications) db.notifications = s.notifications;
      if (db.therapyTutorialSeen === undefined) db.therapyTutorialSeen = false;
      if (!db.overrides) db.overrides = {};
      if (db.work.sessionMinutes === 60) db.work.sessionMinutes = 50;
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

const fmtWhen = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
function notify(db: DB, forRole: NotifRole, kind: string, text: string) {
  db.notifications.push({ id: ++db.seq, forRole, kind, text, createdAt: new Date().toISOString(), read: false });
}

function resolveSub(db: DB) {
  const s = db.sub;
  // Оплата «подтверждается» через ~2.5с после возврата с ЮKassa.
  if (s.status === "pending" && s.pendingSince && Date.now() - s.pendingSince > 2500) {
    const end = new Date();
    end.setDate(end.getDate() + 30);
    if (s.pendingPlan === "tools") s.tools = true;
    else if (s.pendingPlan === "all") { s.tools = true; s.promo = true; }
    else if (s.pendingPlan === "client") s.clientPro = true;
    s.status = "active";
    s.currentPeriodEnd = end.toISOString();
    s.trialEndsAt = null;
    s.pendingPlan = null;
    s.pendingSince = null;
    save(db);
  }
  // Истёкший триал (в демо триал длинный, но обрабатываем честно).
  if (s.status === "trial" && s.trialEndsAt && new Date(s.trialEndsAt).getTime() < Date.now()) {
    s.status = "expired";
    s.tools = false;
    save(db);
  }
}

function withStats(db: DB, c: Client) {
  const done = db.appts.filter((a) => a.clientId === c.id && a.status === "done").length;
  const next = db.appts
    .filter((a) => a.clientId === c.id && a.status === "scheduled" && new Date(a.startsAt) > new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const hw = db.homework.filter((h) => h.clientId === c.id);
  return {
    ...c,
    sessionsDone: done,
    nextAt: next?.startsAt ?? null,
    hwTotal: hw.length,
    hwDone: hw.filter((h) => h.status === "done").length,
  };
}

// Вычислить свободные слоты на дату из выбранных часов минус занятые времена.
function slotsFor(work: WorkHours, dateStr: string, takenISO: string[], overrides: Record<string, SlotOverride>): { start: string; taken: boolean; fmt: ApptFormat }[] {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return [];
  const wd = (d.getDay() + 6) % 7;
  const slots = [...((work.hours ?? {})[wd] ?? [])].sort((a, b) => a.t.localeCompare(b.t));
  const taken = new Set(takenISO.map((t) => new Date(t).getTime()));
  const now = Date.now();
  const out: { start: string; taken: boolean; fmt: ApptFormat }[] = [];
  for (const s of slots) {
    const [hh, mm] = s.t.split(":").map(Number);
    const t = new Date(d); t.setHours(hh, mm, 0, 0);
    if (t.getTime() < now) continue;
    const iso = t.toISOString();
    const ov = overrides[iso];
    if (ov?.removed) continue; // окно снято на эту дату
    out.push({ start: iso, taken: taken.has(t.getTime()), fmt: ov?.fmt ?? s.fmt ?? "online" });
  }
  return out;
}

const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 150));

export async function mockFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const db = load();
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
  const clean = path.split("?")[0];
  const q = new URLSearchParams(path.split("?")[1] ?? "");

  // clients
  if (clean === "/clients" && method === "GET") {
    const list = [...db.clients].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((c) => withStats(db, c));
    return delay(list as T);
  }
  if (clean === "/clients" && method === "POST") {
    const now = new Date().toISOString();
    const c: Client = {
      id: ++db.seq,
      name: String(body.name ?? ""),
      contact: (body.contact as string) || null,
      note: "",
      status: (body.status as Status) ?? "new",
      createdAt: now,
      updatedAt: now,
    };
    db.clients.push(c);
    save(db);
    return delay(withStats(db, c) as T);
  }
  const cid = clean.match(/^\/clients\/(\d+)$/)?.[1];
  if (cid) {
    const id = Number(cid);
    const c = db.clients.find((x) => x.id === id);
    if (!c) throw new Error("API 404");
    if (method === "GET") return delay(withStats(db, c) as T);
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
  if (therapyClient && method === "GET") {
    const id = Number(therapyClient);
    return delay({ moods: db.moods[id] ?? [], wheel: db.wheel[id] ?? null, tutorialSeen: true } as T);
  }

  if (clean === "/my/therapy") {
    const id = 1;
    if (method === "PATCH") {
      if (body.mood !== undefined) {
        const today = new Date(); today.setHours(12, 0, 0, 0);
        const key = today.toISOString().slice(0, 10);
        const entries = db.moods[id] ?? [];
        const found = entries.find((entry) => entry.date.slice(0, 10) === key);
        if (found) found.mood = Math.min(5, Math.max(1, Number(body.mood)));
        else entries.push({ date: today.toISOString(), mood: Math.min(5, Math.max(1, Number(body.mood))) });
        db.moods[id] = entries.slice(-30);
      }
      if (body.wheel && typeof body.wheel === "object") {
        const clean: Record<string, number[]> = {};
        for (const [k, arr] of Object.entries(body.wheel as Record<string, number[]>)) clean[k] = arr.map((v) => Math.min(10, Math.max(0, Number(v))));
        db.wheel[id] = { answers: clean, completedAt: new Date().toISOString() };
      }
      if (body.tutorialSeen !== undefined) db.therapyTutorialSeen = Boolean(body.tutorialSeen);
      save(db);
    }
    if (method === "GET" || method === "PATCH") {
      return delay({ moods: db.moods[id] ?? [], wheel: db.wheel[id] ?? null, tutorialSeen: db.therapyTutorialSeen } as T);
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
    if (body.status !== undefined) h.status = body.status as HwStatus;
    save(db);
    return delay(h as T);
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
    save(db);
    return delay(db.work as T);
  }

  // свободные слоты на дату (psy=1 → клиентское бронирование к специалисту)
  if (clean === "/slots" && method === "GET") {
    const date = q.get("date")!;
    const isClient = q.get("psy") != null;
    const taken = isClient
      ? db.myBookings.map((b) => b.startsAt)
      : db.appts.filter((a) => a.status !== "cancelled").map((a) => a.startsAt);
    return delay(slotsFor(db.work, date, taken, db.overrides) as T);
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
    const taken = isClient
      ? db.myBookings.map((b) => b.startsAt)
      : db.appts.filter((a) => a.status !== "cancelled").map((a) => a.startsAt);
    const out: Record<string, "free" | "full"> = {};
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 60; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i);
      const p = (n: number) => String(n).padStart(2, "0");
      const ymd = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const slots = slotsFor(db.work, ymd, taken, db.overrides);
      if (slots.length === 0) continue;
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
    const { status, trialEndsAt, currentPeriodEnd, tools, promo, clientPro, pendingPlan } = db.sub;
    return delay({ status, trialEndsAt, currentPeriodEnd, tools, promo, clientPro, pendingPlan } as T);
  }
  if (clean === "/billing/subscribe" && method === "POST") {
    const plan = (["tools", "all", "client"].includes(String(body.plan)) ? body.plan : "tools") as "tools" | "all" | "client";
    db.sub = { ...db.sub, status: "pending", pendingPlan: plan, pendingSince: Date.now() };
    save(db);
    return delay({ confirmation_url: "/billing/return" } as T);
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
