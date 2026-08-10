// Снимает кадры разделов для лендинга: в фокусе колонка контента, а не весь экран.
// Запуск: bun run demo (порт из BASE), потом node scripts/landing-shots.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://localhost:3001";
const OUT = "public/shots";
const PAD = 26;   // воздух слева и справа от колонки
const H = 560;    // высота кадра: основные блоки раздела, без «пустого низа»
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const say = (...a) => log.push(a.join(" "));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
page.setDefaultNavigationTimeout(120000);
page.on("pageerror", (e) => say("PAGEERROR:", e.message));

// Настоящий telegram-web-app.js вне мессенджера объявляет платформу «unknown»
// и затирает наш стенд, поэтому его просто не пускаем.
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (req.url().includes("telegram.org/js/telegram-web-app.js")) req.abort();
  else req.continue();
});

// Подделываем Telegram-десктоп: иначе демо оборачивает приложение рамкой
// телефона, и в кадр попадает не интерфейс, а картинка телефона.
await page.evaluateOnNewDocument(() => {
  const noop = () => {};
  const btn = { show: noop, hide: noop, setText: noop, setParams: noop, onClick: noop, offClick: noop };
  window.Telegram = {
    WebApp: {
      platform: "tdesktop", version: "7.10", initData: "", initDataUnsafe: {},
      colorScheme: "light", themeParams: {}, isExpanded: true,
      viewportHeight: 900, viewportStableHeight: 900,
      ready: noop, expand: noop, close: noop, sendData: noop,
      setHeaderColor: noop, setBackgroundColor: noop, setBottomBarColor: noop,
      enableClosingConfirmation: noop, disableClosingConfirmation: noop,
      enableVerticalSwipes: noop, disableVerticalSwipes: noop,
      requestFullscreen: noop, exitFullscreen: noop, openLink: noop, openTelegramLink: noop,
      onEvent: noop, offEvent: noop,
      HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
      BackButton: btn, MainButton: btn, SettingsButton: btn,
      CloudStorage: { getItem: noop, setItem: noop, getItems: noop, removeItem: noop },
    },
  };
});

const dismiss = async () => {
  for (let i = 0; i < 3; i++) {
    const closed = await page.evaluate(() => {
      const words = ["Позже", "Пропустить", "Закрыть", "Понятно", "Готово", "✕"];
      const el =
        document.querySelector("button.x-close") ||
        [...document.querySelectorAll("button")].find(
          (b) => words.includes((b.textContent || "").trim()) || (b.getAttribute("aria-label") || "") === "Закрыть",
        );
      if (el) el.click();
      return !!el;
    });
    if (!closed) break;
    await sleep(450);
  }
  await page.keyboard.press("Escape");
  await sleep(450);
};

/** Кадр вокруг колонки контента: её ширина + воздух, высота — верхние блоки. */
const shot = async (name, path, { skip = 0 } = {}) => {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await sleep(2600);
  await dismiss();
  await sleep(1200);
  const box = await page.evaluate((up) => {
    const col = document.querySelector("div.max-w-3xl");
    if (!col) return null;
    const scroller = col.parentElement;
    if (scroller && up) scroller.scrollTop = up;
    const r = col.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width };
  }, skip);
  if (!box) { say("НЕ НАЙДЕНА колонка:", name); return; }
  await sleep(600);
  const x = Math.max(0, box.x - PAD);
  const y = Math.max(0, box.y + (skip ? 0 : 8));
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x, y, width: Math.min(box.w + PAD * 2, 1280 - x), height: Math.min(H, 900 - y) },
    captureBeyondViewport: false,
  });
  say("ok", name);
};

// --- состояние: психолог, онбординг пройден, две записи на ближайший рабочий день
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem("bereg_onboarded", "1");
  localStorage.setItem("psy_demo_role", "psychologist");
  localStorage.setItem("bereg:schedule-setup-seen:v1", "1");
});
await page.goto(BASE + "/sessions", { waitUntil: "domcontentloaded" });
await sleep(2600);
await dismiss();
await page.evaluate(() => {
  const KEY = "psy_demo_db_v12";
  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  const db = JSON.parse(raw);
  const slot = (t, fmt = "online") => ({ t, d: 50, fmt });
  db.work.hours = {
    0: [slot("10:00"), slot("11:00"), slot("15:00", "offline"), slot("16:00")],
    1: [slot("10:00"), slot("12:00"), slot("16:00")],
    2: [slot("11:00"), slot("13:00", "offline"), slot("17:00")],
    3: [slot("10:00"), slot("12:00"), slot("15:00"), slot("18:00")],
    4: [slot("11:00"), slot("14:00", "offline")],
  };
  const at = (plus, h) => { const d = new Date(); d.setDate(d.getDate() + plus); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  const day = (plus) => { const d = new Date(); d.setDate(d.getDate() + plus); return d.toISOString().slice(0, 10); };
  db.appts = [
    { id: 201, clientId: 1, startsAt: at(1, 11), durationMin: 50, status: "scheduled", note: "", format: "online", client: { id: 1, name: "Марина Соколова" } },
    { id: 202, clientId: 2, startsAt: at(1, 16), durationMin: 50, status: "scheduled", note: "", format: "offline", client: { id: 2, name: "Дмитрий Орлов" } },
    { id: 203, clientId: 1, startsAt: at(3, 12), durationMin: 50, status: "scheduled", note: "", format: "online", client: { id: 1, name: "Марина Соколова" } },
    { id: 204, clientId: 2, startsAt: at(-6, 16), durationMin: 50, status: "done", note: "", format: "online", client: { id: 2, name: "Дмитрий Орлов" } },
    { id: 205, clientId: 1, startsAt: at(-4, 11), durationMin: 50, status: "done", note: "", format: "online", client: { id: 1, name: "Марина Соколова" } },
  ];
  db.homework = [
    { id: 301, clientId: 1, text: "Дневник тревоги: три записи до следующей встречи", status: "done", sentAt: at(-4, 12) },
    { id: 302, clientId: 1, text: "Практика дыхания 4-7-8 перед сном", status: "sent", sentAt: at(-1, 19) },
    { id: 303, clientId: 2, text: "Выписать пять ситуаций, где сработало «должен»", status: "sent", sentAt: at(-2, 10) },
  ];
  db.moods = {
    1: [3, 2, 4, 3, 4, 5, 4].map((m, i) => ({ date: day(i - 6), mood: m })),
    2: [2, 3, 3, 4, 3, 4, 4].map((m, i) => ({ date: day(i - 6), mood: m })),
  };
  db.clients = db.clients.map((c) => ({ ...c, status: "active", link: c.id === 1 ? "linked" : "invited" }));
  db.therapyTutorialSeen = true;
  db.seq = 400;
  localStorage.setItem(KEY, JSON.stringify(db));
});

await shot("d-sessions", "/sessions");
await shot("d-clients", "/clients");
await shot("d-therapy", "/therapy");
await shot("d-catalog", "/catalog");
await shot("d-tools", "/tools");

await browser.close();

// В репозиторий едет только webp: png весят вчетверо больше при том же виде.
const sharp = (await import("sharp")).default;
for (const f of readdirSync(OUT).filter((n) => n.endsWith(".png"))) {
  await sharp(`${OUT}/${f}`).webp({ quality: 86 }).toFile(`${OUT}/${f.replace(/\.png$/, ".webp")}`);
  unlinkSync(`${OUT}/${f}`);
}
console.log(log.join("\n"));
