// Отчёт теста в PDF без внешних библиотек: текст рисуется на canvas, страницы
// вкладываются в PDF как JPEG. Так кириллица не требует встраивания шрифта.

export type PdfBlock =
  | { k: "h1"; text: string }
  | { k: "h2"; text: string }
  | { k: "p"; text: string }
  | { k: "li"; text: string }
  | { k: "bar"; text: string; percent: number; note: string; color: string }
  | { k: "note"; text: string };

const PW = 595.28;
const PH = 841.89;
const SC = 2;
const W = Math.round(PW * SC);
const H = Math.round(PH * SC);
const M = 56 * SC;
const CW = W - M * 2;

const INK = "#201c18";
const MUTED = "#6f675f";
const ACCENT = "#9077bd";
const TRACK = "#f2ece2";

const font = (size: number, weight: number) =>
  `${weight} ${size * SC}px Inter, "Helvetica Neue", Arial, sans-serif`;

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function newPage(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top";
  return { canvas, ctx };
}

function renderPages(blocks: PdfBlock[]): HTMLCanvasElement[] {
  const pages: HTMLCanvasElement[] = [];
  let page = newPage();
  let y = M;
  pages.push(page.canvas);

  const bottom = H - M;
  const brk = (need: number) => {
    if (y + need <= bottom) return;
    page = newPage();
    pages.push(page.canvas);
    y = M;
  };

  for (const b of blocks) {
    const ctx = () => page.ctx;
    if (b.k === "h1") {
      ctx().font = font(21, 800);
      const lines = wrap(ctx(), b.text, CW);
      brk(lines.length * 27 * SC + 12 * SC);
      page.ctx.font = font(21, 800);
      page.ctx.fillStyle = INK;
      for (const l of lines) { page.ctx.fillText(l, M, y); y += 27 * SC; }
      y += 10 * SC;
    } else if (b.k === "h2") {
      ctx().font = font(13, 800);
      const lines = wrap(ctx(), b.text, CW);
      brk(lines.length * 18 * SC + 20 * SC);
      y += 10 * SC;
      page.ctx.font = font(13, 800);
      page.ctx.fillStyle = INK;
      for (const l of lines) { page.ctx.fillText(l, M, y); y += 18 * SC; }
      y += 5 * SC;
    } else if (b.k === "p" || b.k === "note") {
      const size = b.k === "note" ? 8.5 : 10;
      ctx().font = font(size, 500);
      const lines = wrap(ctx(), b.text, CW);
      const lh = size * 1.55 * SC;
      brk(lh * 2);
      page.ctx.font = font(size, 500);
      page.ctx.fillStyle = b.k === "note" ? MUTED : INK;
      for (const l of lines) {
        brk(lh);
        page.ctx.font = font(size, 500);
        page.ctx.fillStyle = b.k === "note" ? MUTED : INK;
        page.ctx.fillText(l, M, y);
        y += lh;
      }
      y += 6 * SC;
    } else if (b.k === "li") {
      ctx().font = font(10, 500);
      const lines = wrap(ctx(), b.text, CW - 16 * SC);
      const lh = 15.5 * SC;
      brk(lh);
      page.ctx.fillStyle = ACCENT;
      page.ctx.beginPath();
      page.ctx.arc(M + 3 * SC, y + 7 * SC, 2.4 * SC, 0, Math.PI * 2);
      page.ctx.fill();
      page.ctx.font = font(10, 500);
      page.ctx.fillStyle = INK;
      for (const l of lines) {
        page.ctx.fillText(l, M + 16 * SC, y);
        y += lh;
        if (y + lh > bottom) { brk(lh); }
      }
      y += 3 * SC;
    } else {
      const rowH = 34 * SC;
      brk(rowH);
      page.ctx.font = font(10, 700);
      page.ctx.fillStyle = INK;
      page.ctx.fillText(b.text, M, y);
      const pctText = `${b.percent}%`;
      page.ctx.font = font(10, 800);
      const pw = page.ctx.measureText(pctText).width;
      page.ctx.fillText(pctText, M + CW - pw, y);
      const barY = y + 16 * SC;
      page.ctx.fillStyle = TRACK;
      roundRect(page.ctx, M, barY, CW, 7 * SC, 3.5 * SC);
      page.ctx.fillStyle = b.color;
      roundRect(page.ctx, M, barY, Math.max(7 * SC, (CW * b.percent) / 100), 7 * SC, 3.5 * SC);
      page.ctx.font = font(8, 600);
      page.ctx.fillStyle = MUTED;
      page.ctx.fillText(b.note, M, barY + 10 * SC);
      y += rowH + 8 * SC;
    }
  }
  return pages;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function assemblePdf(images: Uint8Array[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let len = 0;
  const put = (s: string) => { const b = enc.encode(s); parts.push(b); len += b.length; };
  const putBin = (b: Uint8Array) => { parts.push(b); len += b.length; };

  const n = images.length;
  const total = 2 + n * 3;
  const offsets = new Array<number>(total + 1).fill(0);
  const obj = (num: number, body: string) => { offsets[num] = len; put(`${num} 0 obj\n${body}\nendobj\n`); };

  put("%PDF-1.4\n");

  const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [ ${kids} ] /Count ${n} >>`);

  images.forEach((jpeg, i) => {
    const pageNum = 3 + i * 3;
    const contentNum = pageNum + 1;
    const imgNum = pageNum + 2;
    obj(
      pageNum,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW.toFixed(2)} ${PH.toFixed(2)}] ` +
        `/Resources << /XObject << /Im0 ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>`,
    );
    const stream = `q\n${PW.toFixed(2)} 0 0 ${PH.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
    obj(contentNum, `<< /Length ${stream.length} >>\nstream\n${stream}endstream`);

    offsets[imgNum] = len;
    put(
      `${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    putBin(jpeg);
    put("\nendstream\nendobj\n");
  });

  const xrefAt = len;
  let xref = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= total; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  put(xref);
  put(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const bytes = new Uint8Array(len);
  let at = 0;
  for (const p of parts) { bytes.set(p, at); at += p.length; }
  return new Blob([bytes], { type: "application/pdf" });
}

export async function buildReportPdf(blocks: PdfBlock[]): Promise<Blob> {
  try { await document.fonts?.ready; } catch { /* шрифт не догрузился — рисуем системным */ }
  const pages = renderPages(blocks);
  const images = pages.map((c) => base64ToBytes(c.toDataURL("image/jpeg", 0.86).split(",")[1]));
  return assemblePdf(images);
}

/** Системный «поделиться» с файлом, иначе — скачивание. */
export async function sharePdf(blob: Blob, filename: string, title: string): Promise<void> {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
