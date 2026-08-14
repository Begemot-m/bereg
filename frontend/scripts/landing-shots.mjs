// Снимает кадры разделов для лендинга: телефон целиком, вертикально,
// вместе с нижней навигацией — по ней видно, между чем переключаешься.
// Запуск: bun run demo (порт из BASE), потом node scripts/landing-shots.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://localhost:3001";
const OUT = "public/shots";
const W = 390;    // ширина экрана телефона
const H = 844;    // высота: обычный современный телефон, 9:19.5
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const say = (...a) => log.push(a.join(" "));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
      viewportHeight: 844, viewportStableHeight: 844,
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

/** Экран телефона целиком: от шапки раздела до нижней навигации. */
const shot = async (name, path, { skip = 0 } = {}) => {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await sleep(2600);
  await dismiss();
  // Живая страница сохраняет свой стейт поверх нашего, поэтому наполняем
  // демо-базу и сразу перезагружаемся: снимаем уже наполненный раздел.
  await seedDb();
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2600);
  await dismiss();
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await sleep(1200);
  if (skip) {
    await page.evaluate((up) => {
      const col = document.querySelector("div.max-w-3xl");
      const scroller = col?.parentElement || document.scrollingElement;
      if (scroller) scroller.scrollTop = up;
    }, skip);
  }
  await sleep(600);
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: 0, y: 0, width: W, height: H },
    captureBeyondViewport: false,
  });
  say("ok", name);
};

// --- состояние: психолог, онбординг пройден, две записи на ближайший рабочий день
const patchDb = () => page.evaluate(() => {
  localStorage.setItem("bereg_onboarded", "1");
  localStorage.setItem("psy_demo_role", "psychologist");
  localStorage.setItem("bereg:schedule-setup-seen:v1", "1");
  localStorage.setItem("bereg_therapy_guide_seen_v1", "1");
  const KEY = "psy_demo_db_v12";
  const raw = localStorage.getItem(KEY);
  if (!raw) return false;
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
  return true;
});

// Демо заводит базу лениво, при первом обращении страницы, поэтому ждём её.
const seedDb = async () => {
  for (let i = 0; i < 14; i++) {
    if (await patchDb()) return;
    await sleep(500);
  }
  say("НЕ СОЗДАЛАСЬ демо-база");
};

// Прогрев: на самом первом заходе демо-база ещё не заведена, и первый кадр
// вышел бы пустым. Поэтому сначала заводим её на «Клиентах».
await page.goto(BASE + "/clients", { waitUntil: "domcontentloaded" });
await sleep(2600);
await dismiss();
await patchDb();

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
