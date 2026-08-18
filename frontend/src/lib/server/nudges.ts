import type { PrismaClient } from "@prisma/client";

/**
 * Догоняющие сообщения специалисту.
 *
 * Бот до сих пор писал только по поводу конкретной встречи: записали,
 * перенесли, отменили, напомнили. Человека, который перестал заходить, никто
 * не звал обратно, а статистику своей работы он видел, только если сам открыл
 * приложение. Здесь оба пробела и закрываются: итог недели приходит сам, а
 * тому, кто пропал, приходит повод вернуться.
 *
 * Решение о том, кому и что писать, вынесено в чистую `pickNudges` — на ней
 * тест, потому что ошибка тут значит рассылку не тем и не вовремя.
 */

export type NudgeKind = "weekly" | "idle_clients" | "no_client";

/** Одна строка на специалиста: всё, из чего решается, писать ему или нет. */
export type PsyRow = {
  userId: number;
  telegramId: bigint;
  /** Проведено за последние 7 дней. */
  held: number;
  heldClients: number;
  minutes: number;
  /** Записано на ближайшие 7 дней. */
  ahead: number;
  /** Живые карточки клиентов (демо-карточка не в счёт). */
  clients: number;
  /** Из них без предстоящей записи. */
  clientsIdle: number;
  lastVisit: Date | null;
  createdAt: Date;
};

export type PlannedNudge = {
  recipientId: number;
  telegramId: bigint;
  kind: NudgeKind;
  periodKey: string;
  text: string;
  button: string;
  path: string;
};

type Local = { ymd: string; weekday: number; hour: number };

/** Дата и час в календаре платформы: у людей вечер, а не UTC. */
export function localParts(date: Date, timeZone: string): Local {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: Math.max(0, days.indexOf(get("weekday"))),
    hour: Number(get("hour")) % 24,
  };
}

/** Ключ недели вида 2026-W33 — по нему и ловятся повторы. */
export function weekKey(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
};

const hoursLabel = (minutes: number) => {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${plural(Math.round(rounded), "час", "часа", "часов")}`;
};

const DAY = 86_400_000;

/**
 * Кому и что отправить прямо сейчас. На человека — не больше одного
 * сообщения: итог недели важнее напоминания про клиентов, напоминание про
 * клиентов важнее «пригласите первого».
 */
export function pickNudges(rows: PsyRow[], now: Date, timeZone: string): PlannedNudge[] {
  const local = localParts(now, timeZone);
  const key = weekKey(local.ymd);
  // Итог недели — вечером воскресенья. Остальное — днём, чтобы сообщение не
  // пришло ночью: приложение живёт в Telegram, там это будильник.
  const weeklyTime = local.weekday === 6 && local.hour >= 19;
  const dayTime = local.hour >= 11 && local.hour < 21;
  const out: PlannedNudge[] = [];

  for (const row of rows) {
    if (weeklyTime && (row.held > 0 || row.ahead > 0)) {
      const summary = row.held > 0
        ? `${row.held} ${plural(row.held, "встреча", "встречи", "встреч")} · ${row.heldClients} ${plural(row.heldClients, "клиент", "клиента", "клиентов")} · ${hoursLabel(row.minutes)}`
        : "Встреч на этой неделе не было";
      const ahead = row.ahead > 0
        ? `На следующей неделе записано: ${row.ahead}.`
        : "На следующей неделе записей пока нет.";
      out.push({
        recipientId: row.userId,
        telegramId: row.telegramId,
        kind: "weekly",
        periodKey: key,
        text: `Итог недели\n${summary}\n${ahead}`,
        button: "Открыть сессии",
        path: "/sessions",
      });
      continue;
    }

    if (!dayTime) continue;

    const idleDays = row.lastVisit ? (now.getTime() - row.lastVisit.getTime()) / DAY : Infinity;

    // Перестал заходить, а клиенты остались без следующей встречи. Пока
    // человек в приложении бывает, напоминать не о чем: он это и так видит.
    if (idleDays >= 7 && row.clientsIdle > 0) {
      out.push({
        recipientId: row.userId,
        telegramId: row.telegramId,
        kind: "idle_clients",
        periodKey: key,
        text: `У вас ${row.clientsIdle} ${plural(row.clientsIdle, "клиент", "клиента", "клиентов")} без следующей записи.\nОткройте список — записать можно в два касания.`,
        button: "Открыть клиентов",
        path: "/clients",
      });
      continue;
    }

    // Завёл анкету и пропал, не дойдя до первого клиента. Зовём первый месяц:
    // дальше это уже не подсказка, а надоедание.
    const ageDays = (now.getTime() - row.createdAt.getTime()) / DAY;
    if (row.clients === 0 && ageDays >= 2 && ageDays <= 30) {
      out.push({
        recipientId: row.userId,
        telegramId: row.telegramId,
        kind: "no_client",
        periodKey: key,
        text: "В «Хронике» пока нет ни одного вашего клиента.\nПригласите первого ссылкой — записи, задания и настроение окажутся в одном месте.",
        button: "Пригласить клиента",
        path: "/clients",
      });
    }
  }

  return out;
}

/** Свод по специалистам одним запросом: раз в тик, счётчики дешёвые. */
export async function loadPsyRows(prisma: PrismaClient): Promise<PsyRow[]> {
  return prisma.$queryRaw<PsyRow[]>`
    SELECT u.id::int AS "userId",
           u."telegramId",
           (SELECT count(*) FROM "Appointment" a
             WHERE a."psychologistId" = u.id AND a.status = 'done'
               AND a."startsAt" >= now() - interval '7 days')::int AS held,
           (SELECT count(DISTINCT a."clientId") FROM "Appointment" a
             WHERE a."psychologistId" = u.id AND a.status = 'done'
               AND a."startsAt" >= now() - interval '7 days')::int AS "heldClients",
           (SELECT coalesce(sum(a."durationMin"), 0) FROM "Appointment" a
             WHERE a."psychologistId" = u.id AND a.status = 'done'
               AND a."startsAt" >= now() - interval '7 days')::int AS minutes,
           (SELECT count(*) FROM "Appointment" a
             WHERE a."psychologistId" = u.id AND a.status = 'scheduled'
               AND a."startsAt" >= now() AND a."startsAt" < now() + interval '7 days')::int AS ahead,
           (SELECT count(*) FROM "Client" c
             WHERE c."psychologistId" = u.id AND c.demo = false)::int AS clients,
           (SELECT count(*) FROM "Client" c
             WHERE c."psychologistId" = u.id AND c.demo = false
               AND NOT EXISTS (
                 SELECT 1 FROM "Appointment" a
                  WHERE a."clientId" = c.id AND a.status = 'scheduled' AND a."startsAt" >= now()
               ))::int AS "clientsIdle",
           (SELECT max(v."createdAt") FROM "Visit" v WHERE v."userId" = u.id) AS "lastVisit",
           u."createdAt"
      FROM "User" u
     WHERE u."deletedAt" IS NULL
       AND u."blockedAt" IS NULL
       AND 'psychologist' = ANY(u."roles")`;
}

/**
 * Отправка одного сообщения с защитой от повтора: строка пишется до отправки,
 * и уникальный ключ «получатель + вид + период» не даёт послать второй раз —
 * ни следующим тиком, ни вторым экземпляром воркера.
 */
export async function claimNudge(prisma: PrismaClient, plan: PlannedNudge): Promise<number | null> {
  try {
    const row = await prisma.nudge.create({
      data: { recipientId: plan.recipientId, kind: plan.kind, periodKey: plan.periodKey },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

/**
 * Сообщения по событию, а не по расписанию: их ставит в очередь тот роут, где
 * событие случилось. Текст живёт здесь, а не в строке базы, — `Nudge` хранит
 * только «кому, что и за какой период».
 */
export type EventNudgeKind = "verified";

export const EVENT_NUDGES: Record<EventNudgeKind, { text: string; button: string; path: string }> = {
  verified: {
    text: [
      "✅ Мы подтвердили вашу анкету!",
      "",
      "🗂 Теперь она размещена в каталоге специалистов — вас смогут найти клиенты.",
      "",
      "🌿 Добро пожаловать на платформу «Хроника»!",
      "",
      "👥 Следующим шагом добавьте клиентов, чтобы начать с ними работу.",
      "",
      "⭐️ 14 дней подписки PRO активированы — все возможности платформы без ограничений.",
    ].join("\n"),
    button: "Добавить клиентов",
    path: "/clients",
  },
};

type NudgeDb = Pick<PrismaClient, "nudge">;

/**
 * Ставит событийное сообщение в очередь. Уникальный ключ «получатель + вид +
 * период» и делает всю работу по защите от повторов: второе одобрение той же
 * анкеты приветствие уже не пришлёт, поэтому ошибку вставки глотаем.
 */
export async function queueNudge(db: NudgeDb, input: { recipientId: number; kind: EventNudgeKind; periodKey?: string }) {
  try {
    await db.nudge.create({
      data: { recipientId: input.recipientId, kind: input.kind, periodKey: input.periodKey ?? "once" },
    });
  } catch {
    /* уже в очереди или уже отправлено */
  }
}

export type PendingNudge = { id: number; kind: EventNudgeKind; telegramId: bigint };

/** Что ждёт отправки из событийной очереди. */
export async function loadPendingNudges(prisma: PrismaClient): Promise<PendingNudge[]> {
  const rows = await prisma.nudge.findMany({
    where: { kind: { in: Object.keys(EVENT_NUDGES) }, sentAt: null, error: null },
    select: { id: true, kind: true, recipient: { select: { telegramId: true } } },
    orderBy: { id: "asc" },
    take: 50,
  });
  return rows.map((row) => ({ id: row.id, kind: row.kind as EventNudgeKind, telegramId: row.recipient.telegramId }));
}
