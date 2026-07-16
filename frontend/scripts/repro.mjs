import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 780, isMobile: true }); // узкий: сайдбар скрыт
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { localStorage.setItem("bereg_onboarded", "1"); localStorage.setItem("psy_demo_role", "psychologist"); });

// многократные переходы туда-обратно — триггерим анимации навигации
for (const r of ["/", "/sessions", "/", "/clients", "/", "/cabinet", "/", "/catalog", "/"]) {
  await page.goto(BASE + r, { waitUntil: "networkidle0" });
  await new Promise((x) => setTimeout(x, 400));
}
console.log(errs.length ? errs.join("\n") : "PAGEERROR НЕТ");
await browser.close();
