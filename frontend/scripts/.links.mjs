import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
for (const w of [1280, 390]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 900 });
  page.setDefaultNavigationTimeout(90000);
  await page.goto("https://chronika.space/", { waitUntil: "domcontentloaded" });
  await sleep(6000);
  const links = await page.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))]);
  const texts = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => `${a.textContent.trim().slice(0, 30)} → ${a.getAttribute("href")}`));
  console.log(`--- ширина ${w}: ссылок ${links.length}`);
  console.log(texts.join("\n"));
  await page.close();
}
await browser.close();
