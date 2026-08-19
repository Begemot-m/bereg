// Кадры настоящего интерфейса для лендинга.
//
// Два формата под два блока сайта:
//   w-*.webp — широкий кадр с сайдбаром (вкладки «Сессии/Клиенты/…» в шапке сайта);
//   p-*.webp — телефон целиком с нижней навигацией (карточки блока «Возможности»).
//
// Запуск: bun run demo (порт из BASE), потом node scripts/landing-shots.mjs
// Проверить пачку одним снимком: node scripts/landing-shots.mjs --sheet
import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "public/shots";
const WIDE = { width: 1320, height: 700 };
const PHONE = { width: 390, height: 844 };
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const say = (...a) => log.push(a.join(" "));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
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
  await sleep(400);
};

// Ключ демо-базы растёт с версиями (v12 → v16 → …), поэтому не зашиваем его:
// иначе скрипт молча снимает пустые экраны после очередного бампа.
const patchDb = (role) => page.evaluate((role) => {
  localStorage.setItem("bereg_onboarded", "1");
  localStorage.setItem("psy_demo_role", role);
  localStorage.setItem("bereg:schedule-setup-seen:v1", "1");
  localStorage.setItem("bereg_therapy_guide_seen_v1", "1");
  // Обучающие колоды открываются сами на первом заходе и закрывают собой весь
  // раздел — в кадр попадала бы инструкция, а не интерфейс.
  localStorage.setItem("bereg_clients_help_seen", "1");
  localStorage.setItem("bereg_catalog_survey_seen_v1", "1");
  // Промо-блок про мультитулы съедал полкадра в «Клиентах» — вместо карточек.
  localStorage.setItem("bereg_modules_teaser_hidden", "1");
  const KEY = Object.keys(localStorage).find((k) => /^psy_demo_db_v\d+$/.test(k));
  if (!KEY) return false;
  const db = JSON.parse(localStorage.getItem(KEY));
  const slot = (t, fmt = "online") => ({ t, d: 50, fmt });
  db.work = db.work || {};
  db.work.hours = {
    0: [slot("10:00"), slot("11:00"), slot("15:00", "offline"), slot("16:00")],
    1: [slot("10:00"), slot("12:00"), slot("16:00")],
    2: [slot("11:00"), slot("13:00", "offline"), slot("17:00")],
    3: [slot("10:00"), slot("12:00"), slot("15:00"), slot("18:00")],
    4: [slot("11:00"), slot("14:00", "offline")],
  };
  const at = (plus, h) => { const d = new Date(); d.setDate(d.getDate() + plus); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  const day = (plus) => { const d = new Date(); d.setDate(d.getDate() + plus); return d.toISOString().slice(0, 10); };
  const who = (id, name) => ({ id, name });
  db.appts = [
    { id: 201, clientId: 1, startsAt: at(1, 11), durationMin: 50, status: "scheduled", note: "", format: "online", client: who(1, "Марина Соколова") },
    { id: 202, clientId: 2, startsAt: at(1, 16), durationMin: 50, status: "scheduled", note: "", format: "offline", client: who(2, "Дмитрий Орлов") },
    { id: 203, clientId: 1, startsAt: at(3, 12), durationMin: 50, status: "scheduled", note: "", format: "online", client: who(1, "Марина Соколова") },
    { id: 206, clientId: 2, startsAt: at(4, 10), durationMin: 50, status: "scheduled", note: "", format: "online", client: who(2, "Дмитрий Орлов") },
    { id: 207, clientId: 1, startsAt: at(6, 15), durationMin: 50, status: "scheduled", note: "", format: "offline", client: who(1, "Марина Соколова") },
    { id: 204, clientId: 2, startsAt: at(-6, 16), durationMin: 50, status: "done", note: "", format: "online", client: who(2, "Дмитрий Орлов") },
    { id: 205, clientId: 1, startsAt: at(-4, 11), durationMin: 50, status: "done", note: "", format: "online", client: who(1, "Марина Соколова") },
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
  if (Array.isArray(db.clients)) {
    db.clients = db.clients.map((c) => ({ ...c, status: "active", link: c.id === 1 ? "linked" : "invited" }));
  }
  db.therapyTutorialSeen = true;
  db.seq = 400;
  localStorage.setItem(KEY, JSON.stringify(db));
  return true;
}, role);

// Демо заводит базу лениво, при первом обращении страницы, поэтому ждём её.
const seedDb = async (role) => {
  for (let i = 0; i < 14; i++) {
    if (await patchDb(role)) return true;
    await sleep(500);
  }
  say("НЕ СОЗДАЛАСЬ демо-база");
  return false;
};

const shot = async (name, path, { size, role = "psychologist", scroll = 0 }) => {
  await page.setViewport({ ...size, deviceScaleFactor: 2, isMobile: size === PHONE, hasTouch: size === PHONE });
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await sleep(2600);
  await dismiss();
  // Живая страница сохраняет свой стейт поверх нашего, поэтому наполняем
  // демо-базу и сразу перезагружаемся: снимаем уже наполненный раздел.
  await seedDb(role);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2800);
  await dismiss();
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await sleep(1200);
  if (scroll) {
    await page.evaluate((up) => {
      const col = document.querySelector("div.max-w-3xl");
      const scroller = col?.parentElement || document.scrollingElement;
      if (scroller) scroller.scrollTop = up;
    }, scroll);
    await sleep(600);
  }
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: 0, y: 0, ...size },
    captureBeyondViewport: false,
  });
  say("ok", name);
};

// Прогрев: на самом первом заходе демо-база ещё не заведена, и первый кадр
// вышел бы пустым. Поэтому сначала заводим её на «Клиентах».
await page.setViewport({ ...WIDE, deviceScaleFactor: 1 });
await page.goto(BASE + "/clients", { waitUntil: "domcontentloaded" });
await sleep(3000);
await dismiss();
await seedDb("psychologist");

await shot("w-sessions", "/sessions", { size: WIDE });
await shot("w-clients", "/clients", { size: WIDE });
await shot("w-tools", "/tools", { size: WIDE });
await shot("w-catalog", "/catalog", { size: WIDE, role: "client" });
// «Терапия» снимается со сдвигом: сверху строка «Найти терапевта», а показать
// нужно то, ради чего клиент сюда возвращается, — динамику и задания.
await shot("w-therapy", "/therapy", { size: WIDE, role: "client", scroll: 190 });

await shot("p-sessions", "/sessions", { size: PHONE });
await shot("p-clients", "/clients", { size: PHONE });
await shot("p-catalog", "/catalog", { size: PHONE, role: "client" });

await browser.close();

// В репозиторий едет только webp: png весят вчетверо больше при том же виде.
const sharp = (await import("sharp")).default;
for (const f of readdirSync(OUT).filter((n) => n.endsWith(".png"))) {
  await sharp(`${OUT}/${f}`).webp({ quality: 86 }).toFile(`${OUT}/${f.replace(/\.png$/, ".webp")}`);
  unlinkSync(`${OUT}/${f}`);
}
console.log(log.join("\n"));
