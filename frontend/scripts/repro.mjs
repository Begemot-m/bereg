import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 780, isMobile: true });
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));

const clickText = async (t) => page.evaluate((txt) => {
  const el = [...document.querySelectorAll("button, a")].find((b) => b.textContent.trim().includes(txt));
  if (el) el.click();
  return !!el;
}, t);

// Имитируем СТАРЫЕ данные (v3, форма ranges) — раньше это роняло приложение
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem("bereg_onboarded", "1");
  localStorage.setItem("psy_demo_role", "psychologist");
  localStorage.setItem("psy_demo_db_v3", JSON.stringify({ seq: 1, clients: [], appts: [], work: { ranges: { 0: [{ start: "10:00", end: "18:00" }] }, sessionMinutes: 60 } }));
});

// Психолог: сессии → окна → записать
await page.goto(BASE + "/sessions", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 400));
console.log("Окна:", await clickText("Окна"));
await new Promise((r) => setTimeout(r, 700));
console.log("Записать:", await clickText("Записать"));
await new Promise((r) => setTimeout(r, 700));

// Кабинет: свободные окна + профиль
await page.goto(BASE + "/cabinet", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 400));
console.log("Свободные окна:", await clickText("Свободные окна"));
await new Promise((r) => setTimeout(r, 700));
console.log("Профиль:", await clickText("Профиль специалиста"));
await new Promise((r) => setTimeout(r, 700));

// Клиент: каталог → записаться
await page.evaluate(() => localStorage.setItem("psy_demo_role", "client"));
await page.goto(BASE + "/catalog", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 400));
console.log("Записаться:", await clickText("Записаться"));
await new Promise((r) => setTimeout(r, 900));

console.log(errs.length ? "\n" + errs.join("\n") : "\nPAGEERROR НЕТ");
await browser.close();
