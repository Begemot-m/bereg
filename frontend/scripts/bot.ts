// Telegram-бот и worker очереди уведомлений о сессиях.
// Бот не хранит расписание у себя: каждую доставку ставят в очередь API-роуты.

import { PrismaClient } from "@prisma/client";
import { Bot, InlineKeyboard } from "grammy";

import { addContactClients } from "../src/lib/server/contacts";
import { EVENT_NUDGES, claimNudge, loadPendingNudges, loadPsyRows, pickNudges } from "../src/lib/server/nudges";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

const APP_URL = process.env.APP_URL ?? "https://chronika.space";
const TIME_ZONE = process.env.APP_TIME_ZONE ?? "Europe/Moscow";
const TICK_MS = 30_000;
// Догоняющие сообщения проверяются реже: они привязаны к часу, а не к минуте.
const NUDGE_TICK_MS = 5 * 60_000;

const prisma = new PrismaClient();
const bot = new Bot(token);
const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const appLink = (path: string) => new URL(path, APP_URL).toString();
const format = (value: Date | string) => `${dateFmt.format(new Date(value))} · МСК`;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Клиент";
const formatLabel = (value: string) => value === "offline" ? "очно" : "онлайн";

// Метка приглашения из ссылки: psy_<код> — общая ссылка специалиста,
// inv_<код> — именная, к заведённой карточке. Приложение разбирает её из
// адреса (?startapp=), поэтому кнопка ведёт туда вместе с меткой.
const INVITE_PAYLOAD = /^(?:psy|inv)_[A-Za-z0-9_-]{1,60}$/;
// Остальные метки-ссылки: запись к специалисту и приглашение друга.
const LINK_PAYLOAD = /^(?:book|ref)_[A-Za-z0-9_-]{1,60}$/;

bot.command("start", async (ctx) => {
  const from = ctx.from;
  if (from) {
    await prisma.user.upsert({
      where: { telegramId: BigInt(from.id) },
      create: { telegramId: BigInt(from.id), username: from.username ?? null, firstName: from.first_name ?? null },
      update: { username: from.username ?? null, firstName: from.first_name ?? null },
    });
  }

  // Пришли по приглашению специалиста. Обычная приветственная кнопка ведёт на
  // главную и метку теряет — человек оказывался в приложении сам по себе, без
  // экрана «вас пригласили» и без привязки к специалисту.
  const payload = (ctx.match ?? "").trim();
  if (INVITE_PAYLOAD.test(payload)) {
    await ctx.reply(
      [
        "Вас пригласили в «Хронику» — приложение вашего специалиста.",
        "",
        "Нажмите кнопку ниже: познакомимся с приложением и подключим вас к специалисту.",
      ].join("\n"),
      { reply_markup: new InlineKeyboard().webApp("Принять приглашение", appLink(`/?startapp=${payload}`)) },
    );
    return;
  }

  if (LINK_PAYLOAD.test(payload)) {
    await ctx.reply(
      payload.startsWith("book_")
        ? "Специалист ждёт вас в «Хронике». Откройте приложение — покажу свободные окна для записи."
        : "Вас позвали в «Хронику». Откройте приложение — знакомство займёт минуту.",
      { reply_markup: new InlineKeyboard().webApp("Открыть приложение", appLink(`/?startapp=${payload}`)) },
    );
    return;
  }

  await ctx.reply(
    [
      "Рады вас приветствовать!",
      "",
      "🌿 Нажмите кнопку «Приложение» — и вы в «Хронике».",
      "📌 Чтобы платформа была всегда под рукой, закрепите этот чат: в списке чатов Telegram зажмите диалог с ботом и выберите «Закрепить».",
      "💬 По всем вопросам пишите @mmgorba.",
    ].join("\n"),
    { reply_markup: new InlineKeyboard().webApp("Приложение", appLink("/")) },
  );
});

// Бот отвечал только на /start. На любое другое сообщение он молчал — человек
// писал в чат и решал, что бота нет. Разговаривать бот не умеет и не должен:
// всё живое в мини-приложении, поэтому ответ везде один — подсказка и вход.
const openKeyboard = () => new InlineKeyboard().webApp("Открыть приложение", appLink("/"));

const HELP = [
  "«Хроника» живёт в приложении — здесь я присылаю уведомления и открываю вход.",
  "",
  "🌿 «Открыть приложение» — записи, клиенты, заметки и расписание.",
  "🔔 Напомню о встрече, о новой записи и о переносе — сообщением в этот чат.",
  "💬 Вопрос живому человеку — @mmgorba.",
].join("\n");

bot.command(["help", "app"], async (ctx) => {
  await ctx.reply(HELP, { reply_markup: openKeyboard() });
});

// Выбор контактов для новых карточек. Приложение просит роут `/clients/pick`
// прислать сюда кнопку `request_users` — читать контакты изнутри мини-приложения
// Telegram не даёт, и это единственный нативный выбор. Ответ приходит одним
// сообщением со списком людей: имя, ник и аватарка уже внутри.
bot.on("message:users_shared", async (ctx) => {
  const shared = ctx.message.users_shared.users;
  const psy = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) }, select: { id: true } });
  if (!psy) {
    await ctx.reply("Сначала откройте приложение — там заводятся карточки.", { reply_markup: { remove_keyboard: true } });
    return;
  }

  const result = await addContactClients(
    psy.id,
    shared.map((u) => ({
      userId: u.user_id,
      name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Клиент",
      username: u.username ?? null,
      // Аватарок несколько размеров, берём самый крупный: карточка показывает
      // лицо и на обложке клиента, не только в списке.
      photoId: u.photo?.length ? u.photo[u.photo.length - 1].file_id : null,
    })),
  );

  if (!result.approved) {
    await ctx.reply("Карточки заводит специалист с пройденной проверкой. Загляните в приложение — подскажу, чего не хватает.", { reply_markup: openKeyboard() });
    return;
  }
  if (!result.added.length) {
    await ctx.reply("Не получилось добавить: на бесплатном тарифе места закончились.", { reply_markup: openKeyboard() });
    return;
  }

  const names = result.added.map((c) => c.name).join(", ");
  const created = result.added.filter((c) => c.created).length;
  const one = result.added.length === 1;
  await ctx.reply(
    [
      created ? `Готово: ${one ? "карточка заведена" : "карточки заведены"} — ${names}.` : `${one ? "Карточка уже была" : "Карточки уже были"} — обновил данные: ${names}.`,
      "",
      "Профиль клиента не подключён: истории и настроения пока не будет. Захотите вести карточку вместе — пригласите его из самой карточки.",
      result.limited ? "\nЧасть контактов не поместилась: на бесплатном тарифе места закончились." : "",
    ].join("\n").trim(),
    {
      reply_markup: one
        ? new InlineKeyboard().webApp("Открыть карточку", appLink(`/clients?id=${result.added[0].id}`))
        : new InlineKeyboard().webApp("Открыть клиентов", appLink("/clients")),
    },
  );
});

bot.on("message", async (ctx) => {
  await ctx.reply(
    "Я бот «Хроники»: сам не переписываюсь, но приложение открою.\n\nЕсли нужна подсказка — /help.",
    { reply_markup: openKeyboard() },
  );
});

// Ошибка в обработчике не должна ронять polling: без этого одно неудачное
// сообщение уводило бота в тишину до перезапуска контейнера.
bot.catch((error) => {
  const cause = error.error;
  console.error("bot error", cause instanceof Error ? cause.message : cause);
});

type Delivery = Awaited<ReturnType<typeof dueDeliveries>>[number];

function dueDeliveries() {
  return prisma.telegramDelivery.findMany({
    where: { sentAt: null, cancelledAt: null, scheduledFor: { lte: new Date() }, attempts: { lt: 6 } },
    orderBy: { scheduledFor: "asc" },
    take: 50,
    include: {
      recipient: { select: { telegramId: true } },
      appointment: {
        include: {
          client: { select: { id: true, name: true } },
          psychologist: { select: { firstName: true, psyProfile: { select: { name: true } } } },
        },
      },
    },
  });
}

function messageFor(delivery: Delivery): { text: string; keyboard: InlineKeyboard } {
  const appt = delivery.appointment;
  const client = firstName(appt.client.name);
  const psychologist = appt.psychologist.psyProfile?.name ?? appt.psychologist.firstName ?? "специалистом";
  const when = format(appt.startsAt);
  const details = `${formatLabel(appt.format)} · ${appt.durationMin} минут`;
  const payload = delivery.payload && typeof delivery.payload === "object" && !Array.isArray(delivery.payload)
    ? delivery.payload as Record<string, unknown>
    : {};
  const previous = typeof payload.previousStartsAt === "string" ? format(payload.previousStartsAt) : null;

  if (delivery.audience === "psychologist") {
    const keyboard = new InlineKeyboard();
    if (delivery.kind === "booking") {
      keyboard.webApp("Подтвердить встречу", appLink(`/sessions?appointment=${appt.id}&confirm=1`));
      keyboard.row().webApp("Карточка клиента", appLink(`/clients?id=${appt.client.id}`));
      return {
        text: `К вам записались\n${client} · ${when}\n${details}\n\nЧтобы подтвердить встречу, перейдите в приложение.`,
        keyboard,
      };
    }
    if (delivery.kind === "reschedule") {
      keyboard.webApp("Открыть новое время", appLink(`/sessions?appointment=${appt.id}`));
      return { text: `Клиент перенёс встречу\n${previous ? `Было: ${previous}\n` : ""}Стало: ${when}\n${client} · ${details}`, keyboard };
    }
    if (delivery.kind === "reminder_2h" || delivery.kind === "reminder_24h") {
      keyboard.webApp("Открыть в сессиях", appLink(`/sessions?appointment=${appt.id}`));
      const lead = delivery.kind === "reminder_2h" ? "Через 2 часа" : "Завтра";
      return { text: `${lead} сессия\n${client} · ${when}\n${details}`, keyboard };
    }
    keyboard.webApp("Открыть расписание", appLink(`/sessions?date=${appt.startsAt.toISOString().slice(0, 10)}`));
    return { text: `Клиент отменил встречу\n${client} · ${when}`, keyboard };
  }

  const keyboard = new InlineKeyboard();
  if (delivery.kind === "cancel") {
    keyboard.webApp("Выбрать другое время", appLink(`/catalog?psy=${appt.psychologistId}&book=1`));
    return { text: `Встреча отменена\n${when}\nСпециалист: ${psychologist}`, keyboard };
  }
  keyboard.webApp("Открыть запись", appLink(`/therapy?appointment=${appt.id}&booking=1`));
  if (delivery.kind === "confirm") {
    return { text: `Встреча подтверждена\n${when}\nСпециалист: ${psychologist}\n${details}\nНапомним за 24 часа.`, keyboard };
  }
  if (delivery.kind === "booking") {
    if (!appt.confirmedAt) {
      return { text: `Вы записались\n${when}\nСпециалист: ${psychologist}\n${details}\nЖдём подтверждения — сообщим, как только специалист ответит.`, keyboard };
    }
    return { text: `Запись подтверждена\n${when}\nСпециалист: ${psychologist}\n${details}\nНапомним за 24 часа.`, keyboard };
  }
  if (delivery.kind === "reschedule") {
    return { text: `Встреча перенесена\n${previous ? `Было: ${previous}\n` : ""}Стало: ${when}\nСпециалист: ${psychologist}`, keyboard };
  }
  if (delivery.kind === "reminder_2h") {
    return { text: `Через 2 часа встреча с ${psychologist}\nНачало: ${when}\n${details}`, keyboard };
  }
  return { text: `Напоминаем: завтра встреча с ${psychologist}\n${when}\n${details}`, keyboard };
}

// Прошедшая встреча закрывается сама — тем же правилом, что и в приложении
// (lib/server/appointments.ts). Здесь это нужно для тех, кто в приложение не
// заходит: от статуса зависят статистика, счётчики каталога и старт триала.
//
// Сравнение идёт с `now() AT TIME ZONE 'UTC'`, а не с голым `now()`: колонка —
// `timestamp(3)` без зоны, Prisma пишет в неё UTC, а голый `now()` — это
// `timestamptz`, и Postgres приводил колонку к зоне сессии. На сервере с
// ненулевым TimeZone бот закрывал встречу на несколько часов раньше срока — она
// уезжала из расписания у обеих сторон в свой же день. В приложении это
// починили 26 августа, у бота осталась своя копия запроса.
async function settlePastAppointments() {
  await prisma.$executeRaw`
    UPDATE "Appointment"
    SET "status" = 'done'
    WHERE "status" = 'scheduled'
      AND "startsAt" + ("durationMin" * INTERVAL '1 minute') < (now() AT TIME ZONE 'UTC')`;
}

let delivering = false;
async function sendDueDeliveries() {
  if (delivering) return;
  delivering = true;
  try {
    await settlePastAppointments().catch((error) => console.error("settle error", error));
    const due = await dueDeliveries();
    for (const delivery of due) {
      const { text, keyboard } = messageFor(delivery);
      try {
        await bot.api.sendMessage(Number(delivery.recipient.telegramId), text, { reply_markup: keyboard });
        await prisma.telegramDelivery.update({ where: { id: delivery.id }, data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null } });
      } catch (error) {
        const apiError = error as { error_code?: number; description?: string; message?: string };
        const message = (apiError.description ?? apiError.message ?? "Telegram delivery failed").slice(0, 500);
        const permanent = apiError.error_code === 400 || apiError.error_code === 403;
        const attempts = delivery.attempts + 1;
        await prisma.telegramDelivery.update({
          where: { id: delivery.id },
          data: permanent
            ? { attempts, lastError: message, cancelledAt: new Date() }
            : { attempts, lastError: message, scheduledFor: new Date(Date.now() + Math.min(30, 2 ** attempts) * 60_000) },
        });
        console.error(`Не удалось отправить Telegram-доставку #${delivery.id}: ${message}`);
      }
    }
  } finally {
    delivering = false;
  }
}

// Итог недели и возврат тех, кто перестал заходить. Повтор ловится строкой
// Nudge: она пишется до отправки, ключ «получатель + вид + период» уникален.
let nudging = false;
async function sendNudges() {
  if (nudging) return;
  nudging = true;
  try {
    const plans = pickNudges(await loadPsyRows(prisma), new Date(), TIME_ZONE);
    for (const plan of plans) {
      const id = await claimNudge(prisma, plan);
      if (id === null) continue;
      const keyboard = new InlineKeyboard().webApp(plan.button, appLink(plan.path));
      try {
        await bot.api.sendMessage(Number(plan.telegramId), plan.text, { reply_markup: keyboard });
        await prisma.nudge.update({ where: { id }, data: { sentAt: new Date() } });
      } catch (error) {
        const apiError = error as { description?: string; message?: string };
        const message = (apiError.description ?? apiError.message ?? "Telegram nudge failed").slice(0, 500);
        await prisma.nudge.update({ where: { id }, data: { error: message } });
        console.error(`Не удалось отправить ${plan.kind} #${id}: ${message}`);
      }
    }
  } finally {
    nudging = false;
  }
}

// Событийные сообщения: очередь наполняют роуты, здесь только отправка.
// Строка пишется до отправки, поэтому второй экземпляр воркера тот же
// «verified» не пришлёт — ключ «получатель + вид + период» уникален.
let eventing = false;
async function sendEventNudges() {
  if (eventing) return;
  eventing = true;
  try {
    for (const row of await loadPendingNudges(prisma)) {
      const plan = EVENT_NUDGES[row.kind];
      if (!plan) continue;
      const keyboard = new InlineKeyboard().webApp(plan.button, appLink(plan.path));
      try {
        await bot.api.sendMessage(Number(row.telegramId), plan.text, { reply_markup: keyboard });
        await prisma.nudge.update({ where: { id: row.id }, data: { sentAt: new Date() } });
      } catch (error) {
        const apiError = error as { description?: string; message?: string };
        const message = (apiError.description ?? apiError.message ?? "Telegram event failed").slice(0, 500);
        await prisma.nudge.update({ where: { id: row.id }, data: { error: message } });
        console.error(`Не удалось отправить ${row.kind} #${row.id}: ${message}`);
      }
    }
  } finally {
    eventing = false;
  }
}

async function main() {
  await sendDueDeliveries();
  await sendEventNudges();
  const tick = setInterval(() => {
    void sendDueDeliveries().catch((error) => console.error("notification tick error", error));
    void sendEventNudges().catch((error) => console.error("event tick error", error));
  }, TICK_MS);
  const nudgeTick = setInterval(() => void sendNudges().catch((error) => console.error("nudge tick error", error)), NUDGE_TICK_MS);
  const shutdown = async () => {
    clearInterval(tick);
    clearInterval(nudgeTick);
    await bot.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  // Список команд в меню чата: без него у бота пустая кнопка «Меню».
  await bot.api.setMyCommands([
    { command: "start", description: "Открыть «Хронику»" },
    { command: "help", description: "Что умеет бот" },
  ]).catch((error) => console.error("setMyCommands", error));
  console.log("Telegram worker запущен: события расписания, напоминания клиента, итог недели специалиста, приветствие после верификации.");
  await bot.start();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
