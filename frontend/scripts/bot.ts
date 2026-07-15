// Telegram-бот: напоминания о ближайших сессиях + точка входа (/start).
// Отдельный процесс. Запуск: bun run bot  (нужен TELEGRAM_BOT_TOKEN и DATABASE_URL).
//
// Ограничение Telegram: бот может писать пользователю только после того, как тот
// сам нажал /start. Поэтому психолог сначала запускает бота, затем получает
// напоминания. На /start мы апсертим пользователя, чтобы он был известен системе.

import { PrismaClient } from "@prisma/client";
import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

const LEAD_MIN = Number(process.env.REMINDER_LEAD_MIN ?? 60);
const TICK_MS = 60_000;

const prisma = new PrismaClient();
const bot = new Bot(token);

const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

bot.command("start", async (ctx) => {
  const from = ctx.from;
  if (from) {
    await prisma.user.upsert({
      where: { telegramId: BigInt(from.id) },
      create: {
        telegramId: BigInt(from.id),
        username: from.username ?? null,
        firstName: from.first_name ?? null,
      },
      update: { username: from.username ?? null, firstName: from.first_name ?? null },
    });
  }
  await ctx.reply(
    "Кабинет психолога подключён. Здесь будут приходить напоминания о ближайших сессиях.",
  );
});

async function sendDueReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + LEAD_MIN * 60_000);

  const due = await prisma.appointment.findMany({
    where: {
      status: "scheduled",
      reminderSent: false,
      startsAt: { gt: now, lte: windowEnd },
    },
    include: {
      client: { select: { name: true } },
      psychologist: { select: { telegramId: true } },
    },
  });

  for (const appt of due) {
    const minutesLeft = Math.round((appt.startsAt.getTime() - now.getTime()) / 60_000);
    const text = `Напоминание: через ${minutesLeft} мин сессия с ${appt.client.name} (${timeFmt.format(appt.startsAt)}).`;

    try {
      await bot.api.sendMessage(Number(appt.psychologist.telegramId), text);
    } catch (e) {
      // Часто: психолог ещё не нажал /start у бота. Логируем, но помечаем
      // отправленным, чтобы не спамить попытками каждую минуту.
      console.error(`Не удалось отправить напоминание #${appt.id}:`, (e as Error).message);
    }

    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reminderSent: true },
    });
  }
}

async function main() {
  const tick = setInterval(() => {
    sendDueReminders().catch((e) => console.error("reminder tick error:", e));
  }, TICK_MS);

  const shutdown = async () => {
    clearInterval(tick);
    await bot.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  console.log(`Бот запущен. Напоминания за ${LEAD_MIN} мин до сессии, проверка каждую минуту.`);
  await bot.start();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
