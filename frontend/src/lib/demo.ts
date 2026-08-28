// Демо-режим: приложение работает без бэкенда, на мок-данных в localStorage.
// Включается переменной NEXT_PUBLIC_DEMO=1 (команда `bun run demo`).

// Ключи чужих модулей продублированы строками намеренно: и lib/therapists, и
// lib/catalog ходят через apiFetch, а тот в демо ведёт сюда — импорт замкнул бы
// круг на инициализации модуля.
const THERAPISTS_KEY = "bereg_my_therapists_v1";

// Приём собственного приглашения: ответ сервера один в один, чтобы демо и бой
// вели себя одинаково.
const SELF_INVITE = `API 400: {"error":"self","message":"Это ваша собственная ссылка"}`;
const SELF_INVITE_PATHS = new Set(["/invite/accept", "/clients/join", "/groups/join"]);
const INVITE_EXPIRED = `{"error":"expired","message":"Приглашение больше не действует. Попросите специалиста прислать ссылку ещё раз"}`;
const demoIsPsy = () => typeof window !== "undefined" && localStorage.getItem("psy_demo_role") === "psychologist";

// Зона платформы — единственный внешний импорт: модуль ни от чего не зависит,
// круга на инициализации не будет. Мок обязан резать сутки как сервер.
import { PRO_DISCOUNT_PRICE_RUB, PRO_PRICE_RUB } from "@/lib/pricing";
import { pinManualDays, sameHours } from "@/lib/schedule-pin";
import { addDays as addZoneDays, parseYmd, weekdayOf, zoneAt, zoneYmd } from "@/lib/zone";

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
  /** Имя из учётной записи клиента после синхронизации — психолог может им заменить своё. */
  joinedName?: string | null;
  /** Аватарка клиента. В бою приходит из Telegram, в демо — картинка из public. */
  photo?: string | null;
  /** Карточка-пример от платформы: лимит не занимает, удаляется как обычная. */
  demo?: boolean;
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
  /// Пусто — клиент записался сам и ждёт ответа специалиста.
  confirmedAt?: string | null;
  client: { id: number; name: string; photo?: string | null };
};

type GroupKind = "group" | "pair";
type GroupMember = { id: number; clientId: number | null; name: string; status: "active" | "left"; joinedAt: string };
type MeetFormat = "online" | "offline";
type GroupMeeting = { id: number; startsAt: string; durationMin: number; status: "planned" | "done" | "cancelled"; note: string; format?: MeetFormat | null; place?: string | null; attendance: { memberId: number; present: boolean }[] };
type GroupTask = { id: number; text: string; dueAt: string | null; status: "open" | "done"; createdAt: string };
type GroupPost = { id: number; kind: "post" | "event"; text: string; createdAt: string; reach: number };
type Group = { id: number; title: string; kind: GroupKind; capacity: number; note: string; about: string; format: MeetFormat; place: string; resourceUrl: string; avatar: string; rules: string; price: string; remind24h: boolean; remind2h: boolean; status: "active" | "archived"; createdAt: string; members: GroupMember[]; meetings: GroupMeeting[]; tasks: GroupTask[]; posts: GroupPost[] };
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
  // Предварительная запись: за сколько дней клиент обязан забронировать окно.
  leadDaysOffline?: number;
  leadDaysOnline?: number;
  // Границы шкалы редактора: «работаю с 9 до 22».
  dayFrom?: number;
  dayTo?: number;
};

// Корректировки конкретных дат поверх шаблона: убрать окно / сменить формат
type SlotOverride = { removed?: boolean; fmt?: ApptFormat; added?: boolean; dur?: number };

type DB = {
  seq: number;
  clients: Client[];
  appts: Appointment[];
  homework: Homework[];
  groups: Group[];
  moods: Record<number, Mood[]>;
  goodNotes: Record<number, { date: string; text: string }[]>;
  board: Record<number, string>;
  wheel: Record<number, WheelResult | null>;
  therapyTutorialSeen: boolean;
  reflections: Record<number, SessionReflection[]>;
  myBookings: { id: number; psyName: string; startsAt: string; durationMin: number; format: ApptFormat; confirmed?: boolean }[];
  /** Оценки специалистов каталога: id психолога → моя оценка. */
  reviews: Record<number, number>;
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

// v16 — колесо баланса на две оценки: [насколько доволен, насколько важно].
const KEY = "psy_demo_db_v16";

function iso(daysFromNow: number, hour = 12, min = 0): string {
  const day = addZoneDays(zoneYmd(new Date()), daysFromNow);
  return (zoneAt(day, hour, min) ?? new Date()).toISOString();
}

// Карточка-пример: тот же набор, что заводит сервер новому специалисту
// (lib/server/demo-client.ts). Три недели дневника, четыре проведённые встречи,
// задания, заметки и колесо баланса — чтобы разделы не встречали пустотой.
const DEMO_CLIENT_ID = 3;
const DEMO_MOODS: [number, number, string[]][] = [
  [20, 2, ["напряжение", "страх"]], [19, 2, ["печаль"]], [18, 3, ["напряжение"]],
  [17, 2, ["страх", "вина"]], [16, 3, ["облегчение"]], [15, 3, ["напряжение"]],
  [13, 4, ["облегчение", "интерес"]], [12, 3, ["печаль"]], [11, 3, ["напряжение"]],
  [10, 4, ["интерес"]], [9, 4, ["облегчение"]], [8, 3, ["страх"]],
  [6, 4, ["радость", "гордость"]], [5, 4, ["интерес"]], [4, 5, ["радость"]],
  [3, 4, ["облегчение"]], [2, 4, ["интерес", "гордость"]], [1, 5, ["радость", "облегчение"]],
];
// [насколько довольна, насколько важно] — по две оценки на сферу, как в колесе.
const DEMO_WHEEL: Record<string, number[]> = {
  health: [6, 7], emotions: [4, 9], relationships: [7, 6], family: [8, 5], social: [6, 6],
  work: [3, 8], finance: [5, 6], growth: [6, 7], leisure: [3, 7], environment: [6, 4],
};
// Заметки о встречах — по одной на проведённую сессию, тот же набор, что
// заводит сервер (lib/server/demo-client.ts).
const DEMO_REFLECTIONS: { preparation: string; takeaway: string; feeling: number }[] = [
  { preparation: "Плохо сплю вторую неделю, хочу понять, с чем это связано.", takeaway: "Договорились неделю записывать, во сколько ложусь и как засыпаю.", feeling: 6 },
  { preparation: "Обсудить, что происходит перед защитой диплома.", takeaway: "Попробую дыхание перед сном, посмотрю, помогает ли.", feeling: 7 },
  { preparation: "Дневник веду не каждый день, хочу поговорить почему.", takeaway: "Решили не требовать от себя ежедневных записей.", feeling: 7 },
  { preparation: "Разговор с родителями о переезде.", takeaway: "Стало понятнее, что я хочу им сказать.", feeling: 8 },
];

// Демо «как у нового пользователя». Кнопка в кабинете (видит только владелец и
// только в демо) стирает локальные данные и ставит этот флаг — приложение
// поднимается пустым: без клиентов, записей, графика и анкеты. Прода это не
// касается вовсе: весь код живёт в демо-моке, боевые данные лежат на сервере.
const FRESH_KEY = "psy_demo_fresh";

export function isFreshDemo(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(FRESH_KEY) === "1";
}

// Ник владельца переживает очистку: иначе, посмотрев демо глазами новичка, он
// перестал бы быть владельцем и не нашёл бы кнопку, чтобы вернуть всё обратно.
const OWNER_KEY = "bereg_demo_username";

function wipeKeepingOwner() {
  const owner = localStorage.getItem(OWNER_KEY);
  resetLocalData();
  if (owner) localStorage.setItem(OWNER_KEY, owner);
}

export function startFreshDemo() {
  if (typeof window === "undefined") return;
  wipeKeepingOwner();
  localStorage.setItem(FRESH_KEY, "1");
}

/** Вернуть обычное демо с готовой практикой. */
export function stopFreshDemo() {
  if (typeof window === "undefined") return;
  wipeKeepingOwner();
}

// Демо-группа: дашборд модуля не должен встречать пустотой, как и раздел
// клиентов с карточкой-примером.
const SEED_MEMBER_NAMES = ["Марина Соколова", "Дмитрий Орлов"];
// Остальной состав — люди без карточки клиента: в группу ходят и те, кого
// специалист не ведёт индивидуально, `clientId` у участника необязателен.
const OUTSIDE_MEMBERS = ["Ольга Рыжова", "Павел Ким", "Настя Верещагина", "Кирилл Дорн"];

function seedGroups(clients: Client[], now: string): Group[] {
  // Привязываем к карточкам только тех, кого демо завело само. Раньше брались
  // первые два клиента подряд, и при досеве в уже пожившую базу в состав
  // попадали клиенты владельца: в их карточках всплывал блок «Групповая
  // работа», хотя в группу их никто не добавлял.
  const linked = clients.filter((c) => SEED_MEMBER_NAMES.includes(c.name)).slice(0, 2);
  const members: GroupMember[] = [
    ...linked.map((c, i) => ({ id: 900 + i, clientId: c.id, name: c.name, status: "active" as const, joinedAt: now })),
    ...OUTSIDE_MEMBERS.map((name, i) => ({ id: 902 + i, clientId: null, name, status: "active" as const, joinedAt: now })),
  ];
  // Цикл из восьми встреч по вторникам: три прошли и отмечены, остальные
  // впереди. Без этого дашборд выглядит пустым и не показывает, ради чего
  // модуль. Последний участник пропустил все три подряд — на нём видно ярлык
  // «пропадает», ради которого посещаемость и считается.
  const start = new Date(now);
  start.setHours(19, 0, 0, 0);
  const meetings: GroupMeeting[] = Array.from({ length: 8 }, (_, i) => {
    const at = new Date(start.getTime() + (i - 3) * 7 * 86_400_000);
    const past = i < 3;
    return {
      id: 910 + i,
      startsAt: at.toISOString(),
      durationMin: 90,
      status: past ? "done" : "planned",
      note: "",
      attendance: past
        ? members.map((m, k) => ({ memberId: m.id, present: k === members.length - 1 ? false : !(i === 1 && k === 1) }))
        : [],
    };
  });
  const tasks: GroupTask[] = [
    { id: 930, text: "Записать три ситуации за неделю, где было трудно попросить о помощи", dueAt: meetings[2]?.startsAt ?? null, status: "open", createdAt: now },
  ];
  // Лента: объявление ведущего и след прошлого переноса — чтобы сразу было
  // видно, что группе можно писать разом и что изменения записываются сами.
  const posts: GroupPost[] = [
    { id: 940, kind: "post", text: "Во вторник начинаем ровно в 19:00 — придите на пять минут раньше, дверь домофона закрывается.", createdAt: new Date(+new Date(now) - 2 * 86_400_000).toISOString(), reach: members.length },
    { id: 941, kind: "event", text: `Встреча перенесена: ${fmtWhen(meetings[1]?.startsAt ?? now)}`, createdAt: new Date(+new Date(now) - 9 * 86_400_000).toISOString(), reach: members.length },
  ];
  return [{
    id: 901,
    title: "Группа поддержки «Опоры»",
    kind: "group",
    capacity: 8,
    note: "",
    about: "Закрытая группа на восемь встреч. Всё, что звучит в кругу, остаётся в кругу. Опоздание — не повод не приходить.",
    format: "offline",
    place: "Малый Козихинский пер., 7, кабинет 3",
    resourceUrl: "",
    avatar: "ico:clover",
    rules: "Приходим вовремя. Говорим от себя, а не про других. Всё, что звучит в кругу, остаётся в кругу. Пропуск предупреждаем заранее — место за вами.",
    price: "2500 ₽ за встречу",
    remind24h: true,
    remind2h: true,
    status: "active",
    createdAt: now,
    members,
    meetings,
    tasks,
    posts,
  }];
}

// Специалист, который только что завёл аккаунт: разделы пустые, знакомство и
// блок «С чего начать» показываются заново, анкета не заполнена.
function freshSeed(): DB {
  return {
    seq: 100,
    clients: [],
    appts: [],
    homework: [],
    groups: [],
    moods: {},
    goodNotes: {},
    board: {},
    wheel: {},
    therapyTutorialSeen: false,
    reflections: {},
    myBookings: [],
    reviews: {},
    work: { hours: {}, sessionMinutes: 50, dayFrom: 9, dayTo: 21 },
    overrides: {},
    support: [],
    notifications: [
      { id: 90, forRole: "psychologist", kind: "system", text: "Добро пожаловать в «Хронику». Здесь появляются отмены и переносы сессий.", createdAt: iso(-1, 9, 0), read: false },
      { id: 91, forRole: "client", kind: "system", text: "Добро пожаловать. Здесь будут напоминания и изменения по вашим сессиям.", createdAt: iso(-1, 9, 0), read: false },
    ],
    accountEmail: null,
    reminderSettings: { reminder2h: false },
    sub: { status: "free", trialEndsAt: null, currentPeriodEnd: null, pro: false, pendingPlan: null, pendingSince: null },
  };
}

function seed(): DB {
  if (isFreshDemo()) return freshSeed();
  const now = new Date().toISOString();
  // Демо стартует почти чистым: карточка-пример со всем наполнением и два
  // пустых клиента — записи, настроение и задания у них наполняются руками.
  const clients: Client[] = [
    // Фото — то же, чем демо показывает аватарку из Telegram в бою. Своих лиц у
    // демо нет, поэтому берём портреты из каталога. У Марины лица нет намеренно:
    // так видно, как выглядит карточка без подключённого профиля.
    { id: 1, name: "Марина Соколова", contact: "@marina", note: "", status: "new", link: "none", invitedAt: null, photo: null, notesModuleEnabled: false, notesModuleShared: true, notesModulePsychologist: false, createdAt: now, updatedAt: now },
    { id: 2, name: "Дмитрий Орлов", contact: "@dmitry_orlov", note: "", status: "new", link: "none", invitedAt: null, photo: "/catalog/sergey.webp", notesModuleEnabled: false, notesModuleShared: true, notesModulePsychologist: false, createdAt: now, updatedAt: now },
    {
      id: DEMO_CLIENT_ID,
      name: "Анна (демо)",
      contact: null,
      note: "Тревога перед защитой диплома, сон 4–5 часов.\nХорошо отзывается на дыхание 4-7-8, дома делает через раз.\nДержим фокус на сне и опоре в семье.",
      status: "therapy",
      link: "none",
      invitedAt: null,
      photo: "/demo-client.webp",
      demo: true,
      notesModuleEnabled: true,
      notesModuleShared: true,
      notesModulePsychologist: true,
      createdAt: iso(-30),
      updatedAt: now,
    },
  ];
  const appts: Appointment[] = [28, 21, 14, 7].map((back, index) => ({
    id: 40 + index,
    clientId: DEMO_CLIENT_ID,
    startsAt: iso(-back, 12),
    durationMin: 50,
    status: "done" as const,
    note: "",
    format: "online" as const,
    confirmedAt: iso(-back, 10),
    client: { id: DEMO_CLIENT_ID, name: "Анна (демо)", photo: "/demo-client.webp" },
  }));
  const homework: Homework[] = [
    { id: 50, clientId: DEMO_CLIENT_ID, text: "Дыхание 4-7-8 перед сном, 5 минут", status: "done", sentAt: iso(-21) },
    { id: 53, clientId: DEMO_CLIENT_ID, text: "Отмечать настроение вечером, одной строкой", status: "done", sentAt: iso(-18) },
    { id: 51, clientId: DEMO_CLIENT_ID, text: "Дневник тревоги: ситуация → мысль → что помогло", status: "doing", sentAt: iso(-14) },
    { id: 52, clientId: DEMO_CLIENT_ID, text: "Прогулка 20 минут без телефона", status: "assigned", sentAt: iso(-7) },
  ];
  const moods: Record<number, Mood[]> = {
    [DEMO_CLIENT_ID]: DEMO_MOODS.map(([back, mood, emotions]) => ({ date: iso(-back, 0), mood, emotions })),
  };
  const goodNotes: Record<number, { date: string; text: string }[]> = {
    [DEMO_CLIENT_ID]: [
      { date: iso(-9, 0), text: "Пошла на встречу выпускников, хотя собиралась отменить" },
      { date: iso(-4, 0), text: "Впервые за месяц выспалась" },
    ],
  };
  const wheel: Record<number, WheelResult | null> = {
    [DEMO_CLIENT_ID]: { answers: DEMO_WHEEL, completedAt: iso(-6, 12) },
  };
  // Самозапись, которая ждёт ответа: в демо на ней видно весь путь — янтарное
  // окно в «Сессиях» и очередь подтверждений на главной.
  const pendingAppt: Appointment = {
    id: 44,
    clientId: DEMO_CLIENT_ID,
    startsAt: iso(2, 12),
    durationMin: 50,
    status: "scheduled",
    note: "",
    format: "online",
    confirmedAt: null,
    client: { id: DEMO_CLIENT_ID, name: "Анна (демо)", photo: "/demo-client.webp" },
  };
  const reflections: Record<number, SessionReflection[]> = {
    [DEMO_CLIENT_ID]: appts.map((appt, index) => ({
      appointmentId: appt.id,
      startsAt: appt.startsAt,
      status: "done",
      therapistName: "Специалист",
      preparation: DEMO_REFLECTIONS[index].preparation,
      takeaway: DEMO_REFLECTIONS[index].takeaway,
      feeling: DEMO_REFLECTIONS[index].feeling,
      updatedAt: appt.startsAt,
    })).reverse(),
  };
  return {
    seq: 100,
    clients,
    appts: [...appts, pendingAppt],
    homework,
    groups: seedGroups(clients, now),
    moods,
    goodNotes,
    board: { [DEMO_CLIENT_ID]: "Ушла в отпуск, меня не будет 3 недели." },
    wheel,
    therapyTutorialSeen: false,
    reflections,
    myBookings: [],
    reviews: {},
    // График пустой: окна расставляет сам психолог. Так же ведёт себя прод —
    // `DEFAULT_HOURS` в lib/server/schedule.ts тоже без окон.
    work: {
      hours: {},
      sessionMinutes: 50,
      dayFrom: 9,
      dayTo: 21,
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
      // База, снятая до модуля «Группы»: раздел встречал пустотой, а ссылки на
      // демо-группу вели в никуда. Досеваем её один раз, при первой загрузке.
      if (!db.groups) db.groups = seedGroups(db.clients ?? [], new Date().toISOString());
      // Старый состав демо-группы: два первых клиента базы, кем бы они ни
      // были. Пересобираем её один раз — у клиентов владельца пропадёт чужой
      // блок «Групповая работа» в карточке. Свои группы не трогаем.
      const demoGroup = db.groups.find((g) => g.id === 901);
      if (demoGroup && !demoGroup.members.some((m) => m.clientId === null)) {
        const fresh = seedGroups(db.clients ?? [], new Date().toISOString())[0];
        if (fresh) db.groups = db.groups.map((g) => (g.id === 901 ? fresh : g));
      }
      for (const g of db.groups) {
        if (!g.meetings) g.meetings = [];
        if (!g.tasks) g.tasks = [];
        if (!g.posts) g.posts = [];
        if (g.about === undefined) { g.about = ""; g.format = "offline"; g.place = ""; g.resourceUrl = ""; g.remind24h = true; g.remind2h = true; }
      if (g.avatar === undefined) { g.avatar = ""; g.rules = ""; g.price = ""; }
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
      if (db.work.dayFrom === undefined) db.work.dayFrom = 9;
      if (db.work.dayTo === undefined) db.work.dayTo = 21;
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
  // Прикреплённые терапевты живут в своём ключе и переживали смену версии
  // демо-базы: записей уже нет, а специалист висел в «Терапии» как закреплённый.
  localStorage.removeItem(THERAPISTS_KEY);
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

/**
 * Одно изменение в группе — одно сообщение всем участникам сразу. Запись
 * ложится в ленту группы (ведущий видит, что именно ушло) и уходит
 * уведомлением каждому участнику: перенос, отмена, новая встреча, объявление.
 */
function announce(db: DB, g: Group, kind: GroupPost["kind"], text: string, notifKind = "group") {
  const reach = g.members.filter((m) => m.status === "active").length;
  g.posts.unshift({ id: ++db.seq, kind, text, createdAt: new Date().toISOString(), reach });
  if (reach > 0) notify(db, "client", notifKind, `${g.title}: ${text}`);
  return reach;
}

// То же правило, что в lib/server/access.ts: пробный PRO идёт 14 дней от
// одобрения анкеты, каталог бесплатен всегда.
const TRIAL_DAYS = 14;
const addDays = (from: number, days: number) => new Date(from + days * 86_400_000);

/**
 * Когда анкету одобрили. В демо модерация проходит сама через 6 секунд после
 * подачи; если записи о верификации нет — это готовая демо-практика, считаем
 * её одобренной только что, чтобы бесплатные 14 дней были видны в работе.
 */
function approvedAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("psy_verification");
  // У новичка анкеты нет вовсе — значит и одобрения не было, пробные дни не
  // идут. В обычном демо запись о верификации отсутствует у готовой практики,
  // её считаем одобренной только что.
  if (!raw) return isFreshDemo() ? null : Date.now();
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

  // Подписки нет: считаем триал от одобрения анкеты.
  const started = approvedAt();
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

/** Бесплатный тариф «Старт» — три карточки, дальше приём закрывается. */
const FREE_CLIENT_LIMIT = 3;

/**
 * Принимает ли специалист новые заявки. Правило то же, что на сервере
 * (`lib/server/access.ts`): без PRO места кончаются на третьем клиенте.
 * Уже заведённые карточки продолжают работать — закрыт только вход снаружи.
 */
// Карточка-пример места не занимает — как и на сервере (lib/server/access.ts).
const demoAccepting = (db: DB): boolean => db.sub.pro || db.clients.filter((c) => !c.demo).length < FREE_CLIENT_LIMIT;

const NOT_ACCEPTING = '{"error":"not_accepting","message":"Специалист временно не принимает заявки через платформу"}';

const NEEDS_PRO = `{"error":"needs_pro","message":"Бесплатно можно вести ${FREE_CLIENT_LIMIT} клиентов. Чтобы подтвердить встречу с новым человеком, нужна подписка PRO."}`;

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

const LIMIT_HEAD = "Заняты все бесплатные карточки";

/** Сорвавшаяся из-за лимита заявка — повод сказать об этом психологу. Раз в сутки. */
function notifyLimit(db: DB) {
  const day = Date.now() - 86_400_000;
  if (db.notifications.some((n) => n.text.startsWith(LIMIT_HEAD) && new Date(n.createdAt).getTime() > day)) return;
  notify(db, "psychologist", "system", `${LIMIT_HEAD} (${FREE_CLIENT_LIMIT}) — записаться к вам по-прежнему можно, но подтвердить встречу с новым человеком получится только на PRO. Анкета из каталога никуда не пропадает.`);
}

/** Ответ /subscription в демо: подписка + окно бесплатного каталога. */
function subPayload(db: DB) {
  const approved = approvedAt();
  const catalogUntil = approved === null ? null : addDays(approved, TRIAL_DAYS);
  const { status, trialEndsAt, currentPeriodEnd, pro, pendingPlan } = db.sub;
  return {
    status,
    trialEndsAt,
    trialStarted: approved !== null,
    currentPeriodEnd,
    pro,
    // Размещение бесплатное: одобренная анкета стоит в каталоге всегда.
    catalog: approved !== null,
    catalogUntil: catalogUntil?.toISOString() ?? null,
    pendingPlan,
    // Скидка за отказ в каталоге: в бою её считает сервер по статусу анкеты,
    // в демо статус лежит рядом, в записи о верификации.
    ...(() => {
      const declined = demoCatalogDeclined();
      return {
        priceRub: declined ? PRO_DISCOUNT_PRICE_RUB : PRO_PRICE_RUB,
        fullPriceRub: declined ? PRO_PRICE_RUB : null,
        catalogDeclined: declined,
      };
    })(),
  };
}

/** Отказ модерации в демо живёт в той же записи, что читает кабинет. */
function demoCatalogDeclined(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("psy_verification");
    return Boolean(raw) && (JSON.parse(raw as string) as { status?: string }).status === "declined";
  } catch {
    return false;
  }
}

// Демо-симуляция: спустя ~6с после приглашения клиент «заходит и подключает профиль».
// В боевом режиме это делает реальный вход клиента по ссылке-приглашению.
function resolveClientLinks(db: DB) {
  let changed = false;
  for (const c of db.clients) {
    if (c.link === "invited" && c.invitedAt && Date.now() - new Date(c.invitedAt).getTime() > 6000) {
      c.link = "joined";
      c.updatedAt = new Date().toISOString();
      // Клиент входит под своей учётной записью: имя из его профиля может
      // отличаться от того, как психолог подписал карточку.
      const handle = (c.contact ?? "").replace(/^@/, "").split(/[@\s]/)[0];
      const fromProfile = handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : "";
      c.joinedName = fromProfile && fromProfile.toLowerCase() !== c.name.toLowerCase() ? fromProfile : null;
      notify(db, "psychologist", "join", `«${c.name}»: профиль подключён — карточка синхронизирована`);
      changed = true;
    }
  }
  if (changed) save(db);
}

function withStats(db: DB, c: Client) {
  const doneAppts = db.appts.filter((a) => a.clientId === c.id && a.status === "done");
  // Ближайшая — та, чьё время ещё не вышло целиком: идущая сессия остаётся в
  // списке клиентов, а не пропадает ровно в свой час.
  const next = db.appts
    .filter((a) => a.clientId === c.id && a.status === "scheduled" && +new Date(a.startsAt) + a.durationMin * 60_000 > Date.now())
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

// Встречи групп занимают окно целиком: это вся группа, второй записи в это
// время быть не может. Тот же расчёт на сервере — `groupBusy`.
const groupBusy = (db: DB): Busy[] =>
  db.groups
    .filter((g) => g.status === "active")
    .flatMap((g) => g.meetings.filter((m) => m.status !== "cancelled").map((m) => ({ start: m.startsAt, minutes: m.durationMin })));

// Занятость психолога (его сессии и встречи групп) либо самого пользователя-клиента.
const busyOf = (db: DB, isClient: boolean): Busy[] =>
  isClient
    ? [...db.myBookings.map((b) => ({ start: b.startsAt, minutes: b.durationMin })), ...groupBusy(db)]
    : [...db.appts.filter((a) => a.status !== "cancelled").map((a) => ({ start: a.startsAt, minutes: a.durationMin })), ...groupBusy(db)];

// Правила приёма — те же формулы, что на сервере (lib/server/schedule.ts):
// запись не ближе leadDays, отмена не позже cancelLockDays.
const leadDaysFor = (work: WorkHours, fmt: ApptFormat) =>
  Math.max(0, (fmt === "offline" ? work.leadDaysOffline : work.leadDaysOnline) ?? 0);

const leadBlocked = (startsAt: Date, leadDays: number, now = Date.now()) =>
  leadDays > 0 && (startsAt.getTime() - now) / 86_400_000 < leadDays;

const cancelBlocked = (startsAt: string, lockDays: number, now = Date.now()) =>
  lockDays > 0 && (new Date(startsAt).getTime() - now) / 86_400_000 < lockDays;

// Вычислить свободные слоты на дату из выбранных часов минус занятые времена.
function slotsFor(work: WorkHours, dateStr: string, busy: Busy[], overrides: Record<string, SlotOverride>, applyLead = false): { start: string; taken: boolean; fmt: ApptFormat }[] {
  if (!parseYmd(dateStr)) return [];
  const wd = weekdayOf(dateStr);
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
    const t = zoneAt(dateStr, hh, mm);
    if (!t || t.getTime() < now) continue;
    const iso = t.toISOString();
    const ov = overrides[iso];
    if (ov?.removed) continue; // окно снято на эту дату
    const fmt = ov?.fmt ?? s.fmt ?? "online";
    // Правило предварительной записи — как на сервере: клиент не видит окон
    // ближе, чем разрешил психолог. Самому психологу оно не мешает.
    if (applyLead && leadBlocked(t, leadDaysFor(work, fmt), now)) continue;
    const from = t.getTime();
    const to = from + (s.d || session) * 60000;
    out.push({ start: iso, taken: ranges.some(([bs, be]) => bs < to && from < be), fmt });
  }
  // Разовые окна вне шаблона — открыты психологом на конкретную дату.
  for (const [iso, ov] of Object.entries(overrides)) {
    if (!ov.added || ov.removed) continue;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime()) || at.getTime() < now || zoneYmd(at) !== dateStr) continue;
    if (out.some((s) => s.start === iso)) continue;
    const fmt = ov.fmt ?? "online";
    if (applyLead && leadBlocked(at, leadDaysFor(work, fmt), now)) continue;
    const from = at.getTime();
    const to = from + (ov.dur || session) * 60000;
    out.push({ start: iso, taken: ranges.some(([bs, be]) => bs < to && from < be), fmt });
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}

// Окна каталожного специалиста глазами клиента: правки дат и правила приёма
// берём из настроек психолога в этом же браузере — в демо обе роли один
// человек, иначе выставленный запрет было бы не проверить.
const clientWork = (db: DB): WorkHours => ({
  ...CATALOG_WORK,
  leadDaysOffline: db.work.leadDaysOffline,
  leadDaysOnline: db.work.leadDaysOnline,
});

// Открыто ли окно на самом деле — тот же ответ, что даёт сервер
// (`checkSlotOpen` в lib/server/schedule.ts).
function slotOpen(db: DB, startsAt: Date, exceptId?: number): { ok: true; fmt: ApptFormat } | { ok: false; reason: "closed" | "taken" | "lead"; lead: number; fmt: ApptFormat } {
  const work = clientWork(db);
  const busy: Busy[] = [
    ...db.myBookings.filter((b) => b.id !== exceptId).map((b) => ({ start: b.startsAt, minutes: b.durationMin })),
    ...groupBusy(db),
  ];
  const ymd = zoneYmd(startsAt);
  const iso = startsAt.toISOString();
  const slot = slotsFor(work, ymd, busy, db.overrides, false).find((s) => s.start === iso);
  if (!slot) return { ok: false, reason: "closed", lead: 0, fmt: "online" };
  const lead = leadDaysFor(work, slot.fmt);
  if (slot.taken) return { ok: false, reason: "taken", lead, fmt: slot.fmt };
  if (leadBlocked(startsAt, lead)) return { ok: false, reason: "lead", lead, fmt: slot.fmt };
  return { ok: true, fmt: slot.fmt };
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

/** Выход в демо: сервера нет, поэтому просто возвращаем человека в гости. */
export function enterDemoWebGuest() {
  localStorage.setItem(WEB_GUEST_KEY, "1");
}

// Кто «пригласил» в демо: анкета психолога из этого же браузера. Читаем
// localStorage напрямую — тянуть сюда lib/profile ради трёх полей незачем.
function demoPsyName(): { name: string; photo: string; method: string } {
  const fallback = { name: "Ваш специалист", photo: "", method: "" };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = JSON.parse(localStorage.getItem("bereg_psy_profile") ?? "{}") as { name?: string; photos?: string[]; photo?: string | null; primaryMethod?: string };
    return {
      name: (raw.name ?? "").trim() || fallback.name,
      photo: raw.photos?.[0] ?? raw.photo ?? "",
      method: raw.primaryMethod ?? "",
    };
  } catch {
    return fallback;
  }
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

  // Приглашение клиента ссылкой. В демо кода приглашения нет — ссылка ведёт в
  // то же демо, а карточку «пришедшего» заводим сразу, чтобы сценарий было
  // видно целиком.
  if (clean === "/invite/link" && method === "GET") return delay(({ token: "demo" }) as T);

  // Специалист открыл свою же ссылку — в бою сервер отвечает `self` и ничего не
  // привязывает. Роль читаем строкой по той же причине, что и ключи выше:
  // импорт lib/role замкнул бы круг на инициализации.
  if (SELF_INVITE_PATHS.has(clean) && method === "POST" && demoIsPsy()) throw new Error(SELF_INVITE);

  if (clean === "/invite/preview" && method === "GET") {
    const psy = demoPsyName();
    const token = q.get("token") ?? "";
    // Ссылка на набор в группу: в демо метка — это `g` и номер группы.
    const groupToken = /^g(\d+)$/.exec(token);
    const g = groupToken ? db.groups.find((x) => x.id === Number(groupToken[1])) : null;
    const kind = g ? "group" : token.startsWith("demo") ? "psy" : "card";
    return delay(({
      kind,
      group: g
        ? { id: g.id, title: g.title, kind: g.kind, seats: Math.max(0, g.capacity - g.members.filter((m) => m.status === "active").length) }
        : undefined,
      psy: { id: 1, name: psy.name, photo: psy.photo, method: psy.method, city: "" },
    }) as T);
  }

  if (clean === "/invite/accept" && method === "POST") {
    const name = "Клиент по ссылке";
    const already = db.clients.find((c) => c.name === name);
    if (already) return delay(({ ok: true, clientId: already.id }) as T);
    if (!demoAccepting(db)) { notifyLimit(db); save(db); throw new Error(`API 402: ${NOT_ACCEPTING}`); }
    const now = new Date().toISOString();
    const c: Client = {
      id: ++db.seq,
      name,
      contact: null,
      note: "",
      status: "new",
      link: "joined",
      invitedAt: null,
      notesModuleEnabled: false,
      notesModuleShared: true,
      notesModulePsychologist: false,
      createdAt: now,
      updatedAt: now,
    };
    db.clients.push(c);
    notify(db, "psychologist", "join", `«${name}» пришёл по вашей ссылке — карточка создана`);
    save(db);
    return delay(({ ok: true, clientId: c.id }) as T);
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
    if (!demoAccepting(db)) {
      throw new Error(`API 402: {"error":"limit_reached","message":"На бесплатном тарифе доступно ${FREE_CLIENT_LIMIT} клиента. Подключите PRO, чтобы вести больше."}`);
    }
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
  // Клиент прикрепил специалиста в разделе «Терапия» — у психолога появляется
  // карточка. В бою это делает роут /my/therapists, здесь роли живут в одном
  // браузере, поэтому карточку заводим прямо тут.
  if (clean === "/clients/from-therapy" && method === "POST") {
    const name = String(body.clientName ?? "").trim() || "Клиент";
    const already = db.clients.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.link === "joined");
    if (already) return delay(withStats(db, already) as T);
    // Свободных мест нет — карточка не заводится, и клиент видит нейтральный
    // отказ. Лимит тарифа обойти через «Терапию» нельзя.
    if (!demoAccepting(db)) { notifyLimit(db); save(db); throw new Error(`API 402: ${NOT_ACCEPTING}`); }
    const now = new Date().toISOString();
    const c: Client = {
      id: ++db.seq,
      name,
      contact: (body.contact as string) || null,
      note: "",
      status: "new",
      link: "joined",
      invitedAt: null,
      notesModuleEnabled: false,
      notesModuleShared: true,
      notesModulePsychologist: false,
      createdAt: now,
      updatedAt: now,
    };
    db.clients.push(c);
    notify(db, "psychologist", "join", `«${name}» — новый клиент из раздела «Терапия»: карточка появилась в списке`);
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
    return delay({ ...withStats(db, c), inviteToken: String(c.id) } as T);
  }
  // приём приглашения по ссылке: в демо метка — это номер карточки
  if (clean === "/clients/join" && method === "POST") {
    const c = db.clients.find((x) => x.id === Number(body.token));
    if (!c) throw new Error("API 404");
    // Ссылка живёт месяц с последней отправки — как на сервере.
    const from = new Date(c.invitedAt ?? c.createdAt).getTime();
    if (Date.now() - from > 30 * 86_400_000) throw new Error(`API 410: ${INVITE_EXPIRED}`);
    c.link = "joined";
    c.updatedAt = new Date().toISOString();
    save(db);
    return delay(withStats(db, c) as T);
  }
  // ——— модуль «Группы и пары» ———
  const withMemberPhotos = (g: Group) => ({
    ...g,
    members: g.members
      .filter((m) => m.status === "active")
      .map((m) => ({ ...m, photo: db.clients.find((c) => c.id === m.clientId)?.photo ?? null })),
  });

  if (clean === "/groups") {
    if (method === "GET") return delay(db.groups.filter((g) => g.status === "active").map(withMemberPhotos) as T);
    if (method === "POST") {
      const kind = (body.kind as GroupKind) ?? "group";
      const g: Group = {
        id: ++db.seq,
        title: String(body.title ?? "").trim() || "Без названия",
        // У пары мест ровно два — иначе это уже группа.
        capacity: kind === "pair" ? 2 : Math.max(2, Math.min(40, Number(body.capacity ?? 8))),
        kind,
        note: "",
        status: "active",
        about: "",
        format: "offline",
        place: "",
        resourceUrl: "",
        avatar: "",
        rules: "",
        price: "",
        remind24h: true,
        remind2h: true,
        createdAt: new Date().toISOString(),
        members: [],
        meetings: [],
        tasks: [],
        posts: [],
      };
      db.groups.unshift(g);
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
  }

  // Приход по ссылке набора: карточка клиента и место в составе заводятся
  // одним переходом — ровно то же делает боевой роут.
  if (clean === "/groups/join" && method === "POST") {
    const g = db.groups.find((x) => x.id === Number(String(body.token ?? "").replace(/^g/, "")));
    if (!g || g.status !== "active") throw new Error("API 400");
    const name = "Клиент по ссылке";
    let c = db.clients.find((x) => x.name === name);
    if (!c) {
      if (!demoAccepting(db)) { notifyLimit(db); save(db); throw new Error(`API 402: ${NOT_ACCEPTING}`); }
      const now = new Date().toISOString();
      c = {
        id: ++db.seq,
        name,
        contact: null,
        note: "",
        status: "new",
        link: "joined",
        invitedAt: null,
        notesModuleEnabled: false,
        notesModuleShared: true,
        notesModulePsychologist: false,
        createdAt: now,
        updatedAt: now,
      };
      db.clients.push(c);
    }
    const inGroup = g.members.some((m) => m.clientId === c.id && m.status === "active");
    if (!inGroup) {
      if (g.members.filter((m) => m.status === "active").length >= g.capacity) throw new Error(`API 409: {"error":"no_seats","message":"В группе не осталось мест"}`);
      g.members.push({ id: ++db.seq, clientId: c.id, name: c.name, status: "active", joinedAt: new Date().toISOString() });
      announce(db, g, "event", `В группе новый участник: ${c.name}`);
      notify(db, "psychologist", "join", `«${c.name}» пришёл по ссылке в группу «${g.title}»`);
    }
    save(db);
    return delay(({ ok: true, groupId: g.id, clientId: c.id, joined: !inGroup }) as T);
  }

  const inviteOf = clean.match(/^\/groups\/(\d+)\/invite$/)?.[1];
  if (inviteOf && method === "GET") {
    const g = db.groups.find((x) => x.id === Number(inviteOf));
    if (!g) throw new Error("API 404");
    return delay(({ token: `g${g.id}` }) as T);
  }

  const groupId = clean.match(/^\/groups\/(\d+)$/)?.[1];
  if (groupId) {
    const g = db.groups.find((x) => x.id === Number(groupId));
    if (!g) throw new Error("API 404");
    if (method === "GET") return delay(withMemberPhotos(g) as T);
    if (method === "PATCH") {
      if (body.title !== undefined) g.title = String(body.title);
      if (body.capacity !== undefined) g.capacity = Number(body.capacity);
      if (body.note !== undefined) g.note = String(body.note);
      // Про что участникам важно узнать сразу: где встречаемся и по каким
      // правилам. Приватная заметка ведущего (`note`) — только его.
      if (body.about !== undefined && String(body.about) !== g.about) {
        g.about = String(body.about);
        announce(db, g, "event", "Ведущий обновил описание группы");
      }
      if (body.format !== undefined && body.format !== g.format) {
        g.format = body.format as MeetFormat;
        announce(db, g, "event", `Формат встреч: ${g.format === "online" ? "онлайн" : "очно"}`);
      }
      if (body.place !== undefined && String(body.place) !== g.place) {
        g.place = String(body.place);
        if (g.place) announce(db, g, "event", `Место встреч: ${g.place}`);
      }
      if (body.resourceUrl !== undefined) g.resourceUrl = String(body.resourceUrl);
      if (body.avatar !== undefined) g.avatar = String(body.avatar);
      if (body.rules !== undefined && String(body.rules) !== g.rules) {
        g.rules = String(body.rules);
        announce(db, g, "event", "Ведущий обновил правила группы");
      }
      if (body.price !== undefined && String(body.price) !== g.price) {
        g.price = String(body.price);
        if (g.price) announce(db, g, "event", `Стоимость участия: ${g.price}`);
      }
      if (body.remind24h !== undefined) g.remind24h = Boolean(body.remind24h);
      if (body.remind2h !== undefined) g.remind2h = Boolean(body.remind2h);
      if (body.status !== undefined) g.status = body.status as Group["status"];
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
    if (method === "DELETE") {
      db.groups = db.groups.filter((x) => x.id !== g.id);
      save(db);
      return delay(undefined as T);
    }
  }

  const tasksOf = clean.match(/^\/groups\/(\d+)\/tasks$/)?.[1];
  if (tasksOf) {
    const g = db.groups.find((x) => x.id === Number(tasksOf));
    if (!g) throw new Error("API 404");
    if (method === "POST") {
      const text = String(body.text ?? "").trim();
      g.tasks.unshift({
        id: ++db.seq,
        text,
        dueAt: (body.dueAt as string) ?? null,
        status: "open",
        createdAt: new Date().toISOString(),
      });
      announce(db, g, "event", `Новое задание: ${text.length > 60 ? text.slice(0, 60) + "…" : text}`, "homework");
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
    const task = g.tasks.find((t) => t.id === Number(q.get("taskId")));
    if (!task) throw new Error("API 404");
    if (method === "PATCH") {
      if (body.status !== undefined) task.status = body.status as GroupTask["status"];
      if (body.text !== undefined) task.text = String(body.text);
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
    if (method === "DELETE") {
      g.tasks = g.tasks.filter((t) => t.id !== task.id);
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
  }

  const meetingsOf = clean.match(/^\/groups\/(\d+)\/meetings$/)?.[1];
  if (meetingsOf) {
    const g = db.groups.find((x) => x.id === Number(meetingsOf));
    if (!g) throw new Error("API 404");
    if (method === "POST") {
      const first = new Date(String(body.startsAt));
      const times = Math.max(1, Math.min(52, Number(body.repeatWeeks ?? 1)));
      const dur = Math.max(15, Math.min(480, Number(body.durationMin ?? 90)));
      for (let i = 0; i < times; i++) {
        g.meetings.push({
          id: ++db.seq,
          startsAt: new Date(first.getTime() + i * 7 * 86_400_000).toISOString(),
          durationMin: dur,
          status: "planned",
          note: "",
          attendance: [],
        });
      }
      announce(db, g, "event", times > 1
        ? `В расписании ${times} встреч${times < 5 ? "и" : ""}, первая — ${fmtWhen(first.toISOString())}`
        : `Новая встреча: ${fmtWhen(first.toISOString())}`);
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
    const meeting = g.meetings.find((m) => m.id === Number(q.get("meetingId")));
    if (!meeting) throw new Error("API 404");
    if (method === "PATCH") {
      const was = meeting.startsAt;
      // Перенос и отмена уходят всем сразу. Отметки посещаемости — нет: это
      // рабочая кухня ведущего, участникам про неё сообщать незачем.
      if (body.startsAt !== undefined) {
        meeting.startsAt = new Date(String(body.startsAt)).toISOString();
        if (body.durationMin !== undefined) meeting.durationMin = Math.max(15, Math.min(480, Number(body.durationMin)));
        if (meeting.startsAt !== was) announce(db, g, "event", `Встреча перенесена: было ${fmtWhen(was)}, стало ${fmtWhen(meeting.startsAt)}`, "reschedule");
      }
      if (body.status !== undefined) {
        meeting.status = body.status as GroupMeeting["status"];
        if (meeting.status === "cancelled") announce(db, g, "event", `Встреча отменена · ${fmtWhen(meeting.startsAt)}`, "cancel");
      }
      if (body.attendance !== undefined) meeting.attendance = body.attendance as GroupMeeting["attendance"];
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
    if (method === "DELETE") {
      g.meetings = g.meetings.filter((m) => m.id !== meeting.id);
      if (+new Date(meeting.startsAt) > Date.now()) announce(db, g, "event", `Встреча отменена · ${fmtWhen(meeting.startsAt)}`, "cancel");
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
  }

  // Лента группы: объявление ведущего уходит всем участникам разом.
  const postsOf = clean.match(/^\/groups\/(\d+)\/posts$/)?.[1];
  if (postsOf) {
    const g = db.groups.find((x) => x.id === Number(postsOf));
    if (!g) throw new Error("API 404");
    if (method === "POST") {
      const text = String(body.text ?? "").trim();
      if (text) announce(db, g, "post", text, "announce");
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
    if (method === "DELETE") {
      g.posts = g.posts.filter((p) => p.id !== Number(q.get("postId")));
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
  }

  // Динамика состояний участников: их же дневники настроения, но собранные
  // по группе — одним запросом, чтобы вкладка не дёргала по клиенту на брата.
  const moodOf = clean.match(/^\/groups\/(\d+)\/mood$/)?.[1];
  if (moodOf && method === "GET") {
    const g = db.groups.find((x) => x.id === Number(moodOf));
    if (!g) throw new Error("API 404");
    return delay(g.members.filter((m) => m.status === "active").map((m) => {
      const c = db.clients.find((x) => x.id === m.clientId);
      return {
        memberId: m.id,
        name: m.name,
        photo: c?.photo ?? null,
        rows: (m.clientId ? db.moods[m.clientId] ?? [] : []).map((r) => ({ date: r.date, mood: r.mood })),
      };
    }) as T);
  }

  const membersOf = clean.match(/^\/groups\/(\d+)\/members$/)?.[1];
  if (membersOf) {
    const g = db.groups.find((x) => x.id === Number(membersOf));
    if (!g) throw new Error("API 404");
    const seats = () => g.members.filter((m) => m.status === "active").length;
    if (method === "POST") {
      const taken = new Set(g.members.filter((m) => m.status === "active").map((m) => m.clientId));
      for (const raw of (body.clientIds as number[]) ?? []) {
        if (taken.has(raw) || seats() >= g.capacity) continue;
        const c = db.clients.find((x) => x.id === raw);
        if (!c) continue;
        g.members.push({ id: ++db.seq, clientId: c.id, name: c.name, status: "active", joinedAt: new Date().toISOString() });
        taken.add(c.id);
        announce(db, g, "event", `В группе новый участник: ${c.name}`);
      }
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
    if (method === "DELETE") {
      // Ушедшего помечаем, а не стираем: посещаемость прошлых встреч остаётся.
      const m = g.members.find((x) => x.id === Number(q.get("memberId")));
      if (m) m.status = "left";
      save(db);
      return delay(withMemberPhotos(g) as T);
    }
  }

  const cid = clean.match(/^\/clients\/(\d+)$/)?.[1];
  if (cid) {
    const id = Number(cid);
    const c = db.clients.find((x) => x.id === id);
    if (!c) throw new Error("API 404");
    if (method === "GET") { resolveClientLinks(db); return delay({ ...withStats(db, c), inviteToken: String(c.id) } as T); }
    if (method === "PATCH") {
      if (body.name !== undefined) c.name = String(body.name);
      if (body.contact !== undefined) c.contact = (body.contact as string) || null;
      if (body.note !== undefined) c.note = String(body.note);
      if (body.status !== undefined) c.status = body.status as Status;
      if (body.joinedName !== undefined) c.joinedName = (body.joinedName as string) || null;
      // Отвязка аккаунта от карточки: история встреч и заметок остаётся.
      if (body.detach) { c.link = "none"; c.invitedAt = null; c.joinedName = null; }
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
          const ended = +new Date(booking.startsAt) + booking.durationMin * 60_000 <= Date.now();
          const target: SessionReflection = found ?? { appointmentId, startsAt: booking.startsAt, status: ended ? "done" : "scheduled", therapistName: booking.psyName, preparation: "", takeaway: "", feeling: null, updatedAt: new Date().toISOString() };
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
    // Прошедшая встреча становится состоявшейся сама — как на сервере
    // (lib/server/appointments.ts): без этого «проведено» и статистика стояли
    // в нулях при полном расписании.
    let settled = false;
    for (const a of db.appts) {
      if (a.status !== "scheduled") continue;
      if (new Date(a.startsAt).getTime() + a.durationMin * 60_000 >= Date.now()) continue;
      a.status = "done";
      settled = true;
    }
    if (settled) save(db);
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
      confirmedAt: new Date().toISOString(),
      client: { id: cl.id, name: cl.name, photo: cl.photo ?? null },
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
      if (body.confirm && !a.confirmedAt) {
        // Единственное место, где платформа берёт деньги за приведённого
        // человека. Пока есть свободные места — подтверждаем молча, дальше
        // нужна подписка (как в `confirmGate` на сервере).
        if (!demoAccepting(db)) throw new Error(`API 402: ${NEEDS_PRO}`);
        a.confirmedAt = new Date().toISOString();
        notify(db, "client", "booking", `Встреча подтверждена · ${fmtWhen(a.startsAt)}`);
      }
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
    if (body.hours) {
      const next = body.hours as WorkHours["hours"];
      // Тронутые руками даты не перестраиваем под новый шаблон — прибиваем их
      // разовыми окнами (та же логика, что на сервере).
      if (!sameHours(db.work.hours, next)) {
        const session = Number(body.sessionMinutes) || db.work.sessionMinutes;
        for (const w of pinManualDays(
          { hours: db.work.hours, sessionMinutes: db.work.sessionMinutes },
          { hours: next, sessionMinutes: session },
          db.overrides,
        )) {
          db.overrides[w.iso] = {
            ...(w.removed ? { removed: true } : {}),
            ...(w.fmt ? { fmt: w.fmt } : {}),
            ...(w.added ? { added: true } : {}),
            ...(w.dur ? { dur: w.dur } : {}),
          };
        }
      }
      db.work.hours = next;
    }
    if (body.sessionMinutes) db.work.sessionMinutes = Number(body.sessionMinutes);
    if (body.cancelLockDays !== undefined) db.work.cancelLockDays = Number(body.cancelLockDays);
    if (body.leadDaysOffline !== undefined) db.work.leadDaysOffline = Number(body.leadDaysOffline);
    if (body.leadDaysOnline !== undefined) db.work.leadDaysOnline = Number(body.leadDaysOnline);
    if (body.dayFrom !== undefined) db.work.dayFrom = Number(body.dayFrom);
    if (body.dayTo !== undefined) db.work.dayTo = Number(body.dayTo);
    save(db);
    return delay(db.work as T);
  }

  // свободные слоты на дату (psy=1 → клиентское бронирование к специалисту)
  if (clean === "/slots" && method === "GET") {
    const date = q.get("date")!;
    const isClient = q.get("psy") != null;
    const busy = busyOf(db, isClient);
    // Клиент смотрит окна каталожного специалиста, но правила записи берём из
    // настроек психолога в этом же браузере: в демо обе роли — один человек,
    // и иначе выставленное правило было бы не проверить.
    const work = isClient ? clientWork(db) : db.work;
    return delay(slotsFor(work, date, busy, db.overrides, isClient) as T);
  }

  // корректировки конкретных дат (убрать окно / сменить формат)
  if (clean === "/overrides" && method === "GET") return delay(db.overrides as T);
  if (clean === "/overrides" && method === "PATCH") {
    const iso = String(body.iso);
    const cur = db.overrides[iso] ?? {};
    if (body.removed !== undefined) cur.removed = Boolean(body.removed);
    if (body.fmt !== undefined) cur.fmt = body.fmt as ApptFormat;
    if (body.added !== undefined) cur.added = Boolean(body.added);
    if (body.dur !== undefined) cur.dur = Math.min(240, Math.max(15, Number(body.dur) || 50));
    db.overrides[iso] = cur;
    save(db);
    return delay(db.overrides as T);
  }

  // доступность по дням на ближайшие ~2 месяца: free (есть окна) / full (все заняты)
  if (clean === "/month-availability" && method === "GET") {
    const isClient = q.get("psy") != null;
    const busy = busyOf(db, isClient);
    // День с записью занят, даже если рабочих часов на него не задано.
    const withAppt = new Set(busy.map((b) => zoneYmd(new Date(b.start))));
    const out: Record<string, "free" | "full"> = {};
    const base = zoneYmd(new Date());
    const work = isClient ? clientWork(db) : db.work;
    for (let i = 0; i < 60; i++) {
      const ymd = addZoneDays(base, i);
      const slots = slotsFor(work, ymd, busy, db.overrides, isClient);
      if (slots.length === 0) {
        if (withAppt.has(ymd)) out[ymd] = "full";
        continue;
      }
      out[ymd] = slots.some((s) => !s.taken) ? "free" : "full";
    }
    return delay(out as T);
  }

  // записи клиента-пользователя (его сессии у специалистов)
  // оценки специалиста: в демо своя одна, а средняя берётся из карточки каталога
  if (clean === "/reviews") {
    const psyId = Number(new URLSearchParams(path.split("?")[1] ?? "").get("psy") || body.psychologistId || 0);
    if (method === "POST") {
      db.reviews[Number(body.psychologistId)] = Math.min(5, Math.max(1, Number(body.rating)));
      save(db);
    }
    const mine = db.reviews[psyId];
    return delay({
      rating: mine ?? 0,
      count: mine ? 1 : 0,
      list: mine ? [{ rating: mine, text: "", authorName: "Вы", createdAt: new Date().toISOString(), mine: true }] : [],
    } as T);
  }

  if (clean === "/my/appointments" && method === "GET") {
    // Правило отмены едет вместе с записью — ровно как с сервера.
    const lock = db.work.cancelLockDays ?? 0;
    return delay([...db.myBookings]
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((b) => ({ ...b, cancelLockDays: lock })) as T);
  }
  if (clean === "/my/appointments" && method === "POST") {
    // Записаться можно к любому одобренному специалисту: тариф психолога
    // клиента не касается. Деньги стоят на подтверждении встречи, а не здесь.
    if (!demoAccepting(db)) notifyLimit(db);
    const startsAt = new Date(String(body.startsAt));
    // Окно должно быть открыто по-настоящему: снятая дата, занятое время и
    // запрет на запись действуют и здесь — ровно как на сервере.
    const open = slotOpen(db, startsAt);
    if (!open.ok) {
      if (open.reason === "taken") throw new Error(`API 409: {"error":"Слот уже занят"}`);
      if (open.reason === "lead") throw new Error(`API 422: {"error":"Записаться можно не позже чем за ${open.lead} дн. до встречи"}`);
      throw new Error(`API 409: {"error":"Это время закрыто для записи. Выберите другое окно"}`);
    }
    const fmt = open.fmt;
    // Самозапись ждёт ответа специалиста — как на сервере.
    const b = { id: ++db.seq, psyName: String(body.psyName ?? "Специалист"), startsAt: startsAt.toISOString(), durationMin: Number(body.durationMin ?? db.work.sessionMinutes), format: fmt, confirmed: false };
    db.myBookings.push(b);
    notify(db, "psychologist", "booking", `К вам записались · ${fmtWhen(b.startsAt)}. Подтвердите встречу в приложении`);
    save(db);
    return delay(b as T);
  }
  const myId = clean.match(/^\/my\/appointments\/(\d+)$/)?.[1];
  if (myId) {
    const id = Number(myId);
    const b = db.myBookings.find((x) => x.id === id);
    if (!b) throw new Error("API 404");
    // Запрет на отмену закрывает и перенос: сдвинуть встречу за день до неё —
    // та же отмена. Оба ответа человеческие, их показывает интерфейс.
    const lock = db.work.cancelLockDays ?? 0;
    if (cancelBlocked(b.startsAt, lock)) {
      throw new Error(`API 422: {"error":"Терапевт установил запрет на отмену сессии за ${lock} дн. до встречи. Свяжитесь с ним напрямую"}`);
    }
    if (method === "PATCH") {
      if (body.startsAt) {
        const next = new Date(String(body.startsAt));
        const open = slotOpen(db, next, b.id);
        if (!open.ok) {
          if (open.reason === "taken") throw new Error(`API 409: {"error":"Слот уже занят"}`);
          if (open.reason === "lead") throw new Error(`API 409: {"error":"Записаться можно не позже чем за ${open.lead} дн. до встречи"}`);
          throw new Error(`API 409: {"error":"Это время закрыто для записи. Выберите другое окно"}`);
        }
        b.startsAt = next.toISOString();
        b.confirmed = false;
      }
      notify(db, "psychologist", "reschedule", `Клиент перенёс сессию на ${fmtWhen(b.startsAt)}. Подтвердите новое время в приложении`);
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
  if (clean === "/billing/confirm" && method === "POST") {
    resolveSub(db);
    return delay({ activated: db.sub.status === "active" } as T);
  }

  // переход в психологи: в демо роль живёт в localStorage, серверу подтверждать нечего
  if (clean === "/profile/role" && method === "POST") {
    return delay({ roles: ["client", "psychologist"] } as T);
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
