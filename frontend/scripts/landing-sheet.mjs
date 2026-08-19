// Контактный лист кадров лендинга: все снимки одной картинкой, чтобы
// проверить пачку не открывая восемь файлов.
// Запуск: node scripts/landing-sheet.mjs → scripts/.landing-sheet.png
import sharp from "sharp";

const OUT = process.env.SHEET || "scripts/.landing-sheet.png";
const W = 520, H = 276, PW = 200, PH = 433, GAP = 8;
const wide = ["w-sessions", "w-clients", "w-tools", "w-catalog", "w-therapy"];
const phone = ["p-sessions", "p-clients", "p-catalog"];

const layers = [];
for (const [i, n] of wide.entries()) {
  layers.push({
    input: await sharp(`public/shots/${n}.webp`).resize(W, H).png().toBuffer(),
    left: (i % 2) * (W + GAP),
    top: Math.floor(i / 2) * (H + GAP),
  });
}
const row = 3 * (H + GAP);
for (const [i, n] of phone.entries()) {
  layers.push({
    input: await sharp(`public/shots/${n}.webp`).resize(PW, PH).png().toBuffer(),
    left: i * (PW + GAP),
    top: row,
  });
}

await sharp({ create: { width: 2 * (W + GAP), height: row + PH, channels: 3, background: "#ffffff" } })
  .composite(layers)
  .png()
  .toFile(OUT);
console.log("ok", OUT);
