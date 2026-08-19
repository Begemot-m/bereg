import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "https://begemot-m.github.io/bereg";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900, isMobile: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem("bereg_onboarded", "1");
  localStorage.setItem("psy_demo_role", "client");
  localStorage.setItem("bereg_guide_done", "1");
  localStorage.setItem("bereg_therapy_tutorial", "1");
});
const dump = async (tag) => {
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("bereg_my_therapists_v1") || "null"));
  console.log(tag, JSON.stringify(s && { list: s.list, removed: s.removed, active: s.active, ids: s.ids }));
};
await page.goto(BASE + "/catalog/", { waitUntil: "networkidle0" });
await wait(2200);
await page.evaluate(() => document.querySelector("button.chunk")?.click());
await wait(1600);
console.log("в терапию:", await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().includes("В терапию")); if (!b) return false; b.click(); return true; }));
await wait(1600);
// Запись к этому же специалисту — как у живого клиента.
await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("psy_demo_db_v16"));
  const at = new Date(Date.now() + 5 * 86400000);
  at.setHours(12, 0, 0, 0);
  db.myBookings = [{ id: 9001, psychologistId: 1, psyName: "Ирина Верещагина", startsAt: at.toISOString(), durationMin: 50, format: "online", confirmed: true }];
  localStorage.setItem("psy_demo_db_v16", JSON.stringify(db));
});
await page.goto(BASE + "/therapy/", { waitUntil: "networkidle0" });
await wait(2500);
await dump("до:");
const clicked = await page.evaluate(() => { const b = document.querySelector('[aria-label="Открепить терапевта"]'); if (!b) return false; b.click(); return true; });
console.log("кнопка открепления:", clicked);
await wait(900);
const confirmed = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Открепить"); if (!b) return false; b.click(); return true; });
console.log("подтверждение:", confirmed);
await wait(2500);
await dump("после:");
console.log("виден в разделе:", await page.evaluate(() => !!document.querySelector('[data-tour="therapist"]')));
await page.reload({ waitUntil: "networkidle0" });
await wait(2500);
await dump("после перезагрузки:");
console.log("виден после перезагрузки:", await page.evaluate(() => !!document.querySelector('[data-tour="therapist"]')));
await browser.close();
