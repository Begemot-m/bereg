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

const dismiss = async () => {
  await page.evaluate(() => {
    for (const t of ["Позже", "Пропустить", "Закрыть", "Понятно"]) {
      const el = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === t);
      if (el) el.click();
    }
  });
  await sleep(500);
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
});
await page.goto(BASE + "/sessions", { waitUntil: "domcontentloaded" });
await sleep(2600);
await dismiss();
await page.evaluate(() => {
  const KEY = "psy_demo_db_v12";
  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  const db = JSON.parse(raw);
  const wd = (d) => (d.getDay() + 6) % 7;
  let target = null;
  for (let i = 1; i <= 8; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if ((db.work.hours[wd(d)] || []).length >= 4) { target = d; break; }
  }
  if (!target) return;
  const at = (h) => { const d = new Date(target); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  db.appts = [
    { id: 201, clientId: 1, startsAt: at(11), durationMin: 50, status: "scheduled", note: "", format: "online", client: { id: 1, name: "Марина Соколова" } },
    { id: 202, clientId: 2, startsAt: at(16), durationMin: 50, status: "scheduled", note: "", format: "offline", client: { id: 2, name: "Дмитрий Орлов" } },
  ];
  db.seq = 300;
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
