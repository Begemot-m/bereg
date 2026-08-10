// Telegram-бот и worker очереди уведомлений о сессиях.
// Бот не хранит расписание у себя: каждую доставку ставят в очередь API-роуты.

import { PrismaClient } from "@prisma/client";
import { Bot, InlineKeyboard } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

const APP_URL = process.env.APP_URL ?? "https://chronika.space";
const TIME_ZONE = process.env.APP_TIME_ZONE ?? "Europe/Moscow";
const TICK_MS = 30_000;

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

bot.command("start", async (ctx) => {
  const from = ctx.from;
  if (from) {
    await prisma.user.upsert({
      where: { telegramId: BigInt(from.id) },
      create: { telegramId: BigInt(from.id), username: from.username ?? null, firstName: from.first_name ?? null },
      update: { username: from.username ?? null, firstName: from.first_name ?? null },
    });
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
      keyboard.webApp("Открыть в сессиях", appLink(`/sessions?appointment=${appt.id}`));
      keyboard.row().webApp("Карточка клиента", appLink(`/clients?id=${appt.client.id}`));
      return { text: `Новая запись\n${client} · ${when}\n${details}`, keyboard };
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
  if (delivery.kind === "booking") {
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

let delivering = false;
async function sendDueDeliveries() {
  if (delivering) return;
  delivering = true;
  try {
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

async function main() {
  await sendDueDeliveries();
  const tick = setInterval(() => void sendDueDeliveries().catch((error) => console.error("notification tick error", error)), TICK_MS);
  const shutdown = async () => {
    clearInterval(tick);
    await bot.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  console.log("Telegram worker запущен: события расписания и напоминания клиента.");
  await bot.start();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
