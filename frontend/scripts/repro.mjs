import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 120)); });

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { localStorage.setItem("bereg_onboarded", "1"); localStorage.setItem("psy_demo_role", "psychologist"); });

for (const r of ["/cabinet", "/", "/sessions", "/clients", "/clients/1", "/catalog", "/tools"]) {
  await page.goto(BASE + r, { waitUntil: "networkidle0" });
  await new Promise((x) => setTimeout(x, 500));
}
console.log(errs.length ? errs.join("\n") : "ОШИБОК НЕТ");
await browser.close();
