/**
 * Разовая рассылка анонса из бота. Операция необратимая, поэтому скрипт ведёт
 * журнал отправок и на повторном запуске пропускает тех, кто в нём уже есть.
 *
 *   node scripts/broadcast.mjs --text posts/2026-08-28-invite.html \
 *     --photo cover.png --to @mmgorba          # предпросмотр одному
 *   node scripts/broadcast.mjs --text ... --photo ... --all
 *
 * Запускается там, где есть DATABASE_URL и TELEGRAM_BOT_TOKEN, — то есть внутри
 * контейнера приложения на VPS.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? "";
};
const has = (name) => args.includes(name);

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан");

const textPath = flag("--text");
if (!textPath) throw new Error("нужен --text <файл с текстом поста>");
const text = readFileSync(resolve(textPath), "utf8").trim();

const photoPath = flag("--photo");
if (photoPath && !existsSync(resolve(photoPath))) throw new Error(`нет файла ${photoPath}`);

const to = flag("--to");
const all = has("--all");
if (!to && !all) throw new Error("нужен --to <@username|chat_id> или --all");

const logPath = resolve(flag("--log") ?? `broadcast-${basename(textPath, ".html")}.log`);
const sent = new Set(
  existsSync(logPath)
    ? readFileSync(logPath, "utf8").split("\n").map((l) => l.split(" ")[0]).filter(Boolean)
    : [],
);

const api = (method) => `https://api.telegram.org/bot${token}/${method}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Подпись к фото у Telegram обрезается на 1024 символах — длинный пост уходит
// картинкой без подписи и следом отдельным сообщением.
const CAPTION_LIMIT = 1024;
const captionFits = text.length <= CAPTION_LIMIT;

/** 3 попытки с нарастающей паузой: обрыв TLS посреди прогона — не повод падать. */
async function call(method, body, isForm = false) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(api(method), isForm ? { method: "POST", body } : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) return data.result;
      // Заблокировал бота или никогда ему не писал — на сотне адресатов норма.
      const skip = res.status === 403 || /chat not found/i.test(data.description ?? "");
      if (skip) return { skipped: data.description ?? "forbidden" };
      if (res.status === 429) {
        await sleep(((data.parameters?.retry_after ?? 3) + 1) * 1000);
        continue;
      }
      throw new Error(`${method}: ${data.description ?? res.status}`);
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(attempt * 3000);
    }
  }
}

let fileId = null;

/** Первому получателю фото уходит файлом, дальше — уже готовым file_id. */
async function sendPhoto(chatId) {
  const caption = captionFits ? text : undefined;
  if (fileId) {
    return call("sendPhoto", { chat_id: chatId, photo: fileId, caption, parse_mode: "HTML" });
  }
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("photo", new Blob([readFileSync(resolve(photoPath))]), basename(photoPath));
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  const res = await call("sendPhoto", form, true);
  const photos = res?.photo;
  if (Array.isArray(photos) && photos.length) fileId = photos[photos.length - 1].file_id;
  return res;
}

async function deliver(chatId) {
  const res = photoPath ? await sendPhoto(chatId) : { skipped: null };
  if (res?.skipped) return res.skipped;
  if (!photoPath || !captionFits) {
    const msg = await call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
    if (msg?.skipped) return msg.skipped;
  }
  return null;
}

const prisma = new PrismaClient();

const recipients = to
  ? [
      await prisma.user.findFirst({
        where: to.startsWith("@")
          ? { username: { equals: to.slice(1), mode: "insensitive" } }
          : { telegramId: BigInt(to) },
        select: { telegramId: true, username: true },
      }),
    ].filter(Boolean)
  : await prisma.user.findMany({
      where: { roles: { has: "psychologist" }, deletedAt: null, blockedAt: null },
      select: { telegramId: true, username: true },
      orderBy: { id: "asc" },
    });

if (!recipients.length) throw new Error(to ? `в базе нет ${to}` : "получателей нет");

const queue = recipients.filter((u) => !sent.has(String(u.telegramId)));
console.log(`получателей: ${recipients.length}, из них новых: ${queue.length}, журнал: ${logPath}`);
if (has("--dry")) process.exit(0);

let ok = 0;
let skipped = 0;
for (const user of queue) {
  const chatId = String(user.telegramId);
  try {
    const skip = await deliver(chatId);
    appendFileSync(logPath, `${chatId} ${skip ? `skipped ${skip}` : "ok"}\n`);
    if (skip) skipped++;
    else ok++;
  } catch (e) {
    console.error(`${chatId}: ${e.message}`);
    break;
  }
  await sleep(50);
}

console.log(`отправлено: ${ok}, пропущено: ${skipped}`);
await prisma.$disconnect();
