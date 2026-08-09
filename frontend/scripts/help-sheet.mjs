// Собирает контактный лист из кадров public/help — один PNG для быстрой проверки.
import puppeteer from "puppeteer-core";
import { readdirSync, readFileSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const files = readdirSync("public/help").filter((f) => f.endsWith(".webp")).sort();
const tiles = files.map((f) => {
  const b64 = readFileSync(`public/help/${f}`).toString("base64");
  return `<figure><img src="data:image/webp;base64,${b64}"><figcaption>${f}</figcaption></figure>`;
}).join("");
const html = `<style>body{margin:0;background:#222;font:11px system-ui;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px}
figure{margin:0}img{width:100%;display:block}figcaption{color:#fff;padding:2px}</style>${tiles}`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 800 });
await page.setContent(html);
await page.screenshot({ path: "scripts/.help-sheet.png", fullPage: true });
await browser.close();
