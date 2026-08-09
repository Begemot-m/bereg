// Снимает кадры интерфейса для «Как это работает?» (help-deck).
// Запуск: bun run demo (порт из BASE), потом node scripts/help-shots.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://localhost:3001";
const OUT = "public/help";
const W = 390, H = 244; // 16:10 под object-cover в HelpDeck
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const say = (...a) => log.push(a.join(" "));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.setDefaultNavigationTimeout(120000);
page.on("pageerror", (e) => say("PAGEERROR:", e.message));

const clickText = async (txt, tag = "button, a") => {
  const ok = await page.evaluate((t, sel) => {
    const el = [...document.querySelectorAll(sel)].find((b) => (b.textContent || "").includes(t));
    if (el) el.click();
    return !!el;
  }, txt, tag);
  say(ok ? "клик:" : "КЛИК НЕ НАЙДЕН:", txt);
  return ok;
};

const open = async () => {
  await page.goto(BASE + "/sessions", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("div[data-tour='views']", { timeout: 60000 });
  await sleep(900);
  // окно «первый шаг» перекрывает экран — закрываем
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Позже");
    if (el) el.click();
  });
  await sleep(700);
};

// Кадр 390x244 вокруг элемента: скроллим контейнер, центрируем, режем по вьюпорту
const shot = async (name, txt, opts = {}) => {
  const { tag = "*", shift = 0, index = 0 } = opts;
  const res = await page.evaluate((t, sel, i) => {
    const all = [...document.querySelectorAll(sel)];
    const els = all.filter((e) => (e.textContent || "").includes(t) && e.getBoundingClientRect().height > 0);
    const leaves = els.filter((e) => !els.some((o) => o !== e && e.contains(o)));
    const el = leaves[i] ?? els[els.length - 1];
    if (!el) return { ok: false, all: all.length, hit: els.length, inBody: document.body.innerText.includes(t) };
    el.scrollIntoView({ block: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    return { ok: true, top: r.top, bottom: r.bottom };
  }, txt, tag, index);
  if (!res.ok) { say(`НЕ НАЙДЕН ${name} «${txt}» tag=${tag} узлов=${res.all} совпало=${res.hit} втексте=${res.inBody}`); return; }
  await sleep(300);
  const center = (res.top + res.bottom) / 2 + shift;
  const y = Math.max(6, Math.min(844 - 92 - H, center - H / 2));
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y, width: W, height: H }, captureBeyondViewport: false });
  say("ok " + name);
};

// --- состояние: психолог, две записи на ближайший рабочий день
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem("bereg_onboarded", "1");
  localStorage.setItem("psy_demo_role", "psychologist");
});
await open();
await page.evaluate(() => {
  const KEY = "psy_demo_db_v12";
  const db = JSON.parse(localStorage.getItem(KEY));
  const wd = (d) => (d.getDay() + 6) % 7;
  let target = null;
  for (let i = 1; i <= 8; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if ((db.work.hours[wd(d)] || []).length >= 4) { target = d; break; }
  }
  const at = (h) => { const d = new Date(target); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  db.appts = [
    { id: 201, clientId: 1, startsAt: at(11), durationMin: 50, status: "scheduled", note: "", format: "online", client: { id: 1, name: "Марина Соколова" } },
    { id: 202, clientId: 2, startsAt: at(16), durationMin: 50, status: "scheduled", note: "", format: "offline", client: { id: 2, name: "Дмитрий Орлов" } },
  ];
  db.seq = 300;
  localStorage.setItem(KEY, JSON.stringify(db));
});
await open();

// 1. Шапка: График / плюс / Календарь
await shot("s1-schedule", "График", { tag: "button[data-tour='schedule']", shift: 60 });

// 2. Переключатель Ближайшие / Неделя
await shot("s2-views", "Ближайшие", { tag: "div[data-tour='views']", shift: 90 });

// 3-6. Неделя целиком: свободные и занятые окна
await clickText("Неделя");
await sleep(1400);
await shot("s3-week", "свободно", { tag: "div", index: 0, shift: 40 });

// занятое окно раскрыто
await clickText("Марина");
await sleep(1400);
await shot("s4-appt", "Освободить", { tag: "button", shift: -40 });
await clickText("Марина");
await sleep(900);

// свободное окно раскрыто: «Кого записать» + «Удалить окно»
const freeOpen = await page.evaluate(() => {
  const el = [...document.querySelectorAll("button[aria-expanded]")].find((b) => (b.textContent || "").includes("свободно"));
  if (el) el.click();
  return !!el;
});
say("свободное окно:", String(freeOpen));
await sleep(1400);
await shot("s5-book", "Выбрать клиента", { tag: "button", shift: -30 });
await shot("s6-window", "Удалить окно", { tag: "button", shift: -50 });

// 7. Календарь: выбор нескольких дней + действия
await clickText("Календарь");
await sleep(1400);
await clickText("Выбор");
await sleep(900);
await page.evaluate(() => {
  const days = [...document.querySelectorAll("button")].filter((b) => /^\d{1,2}$/.test((b.textContent || "").trim()));
  const start = Math.max(0, days.length - 12);
  for (const b of days.slice(start, start + 3)) b.click();
});
await sleep(800);
await clickText("Действия");
await sleep(1400);
await shot("s7-vacation", "Открыть окна", { tag: "button", shift: -110 });

// --- редактор графика
await open();
await page.evaluate(() => document.querySelector("button[data-tour='schedule']")?.click());
await page.waitForSelector("input[type='range'], [role='slider']", { timeout: 20000 }).catch(() => say("слайдер не дождались"));
await sleep(1800);

await shot("w1-hours", "Работаю", { tag: "span", shift: 60 });
await shot("w2-length", "Длина новой сессии", { tag: "span", shift: 50 });
await shot("w3-rail", "11:00–11:50", { tag: "*", shift: 60 });
await shot("w4-format", "13:00–13:50", { tag: "*", shift: 0 });
await shot("w5-copy", "На будни", { tag: "button", shift: 40 });
await shot("w6-rules", "Запрет отмены сессий", { tag: "p", shift: 80 });

await browser.close();

// В репозиторий едет только webp: png весят вчетверо больше при том же виде.
const sharp = (await import("sharp")).default;
for (const f of readdirSync(OUT).filter((n) => n.endsWith(".png"))) {
  await sharp(`${OUT}/${f}`).webp({ quality: 82 }).toFile(`${OUT}/${f.replace(/\.png$/, ".webp")}`);
  unlinkSync(`${OUT}/${f}`);
}
console.log(log.join("\n"));
