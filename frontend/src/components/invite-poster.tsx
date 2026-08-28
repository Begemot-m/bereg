"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { APP_NAME, APP_SITE } from "@/lib/brand";
import { asset } from "@/lib/asset";
import { formatMoney, type Currency } from "@/lib/money";
import { select } from "@/lib/haptics";
import type { FreeDay, Span } from "@/lib/invite-windows";

/**
 * Афиша свободных окон — вертикальная карточка, которую специалист отправляет
 * клиенту. Одна вёрстка на три места: сам экран афиши, превью в кабинете и
 * образец при отправке. Картинку для сторис рисует posterPng ниже — той же
 * рукой, но на canvas.
 */

export type PosterPsy = {
  name: string;
  portrait?: string;
  method?: string;
  specialistTypes?: string[];
  years?: number;
  price?: number;
  currency?: Currency;
  minutes?: number;
  city?: string;
  format?: "online" | "offline" | "both";
  verified?: boolean;
};

const isInlineImage = (src: string) => /^(data:|blob:)/i.test(src);

const SPAN_LABEL: Record<Span, string> = { week: "на ближайшие дни", next: "на следующую неделю" };

const yearsWord = (n: number) => {
  const last = n % 100 > 10 && n % 100 < 20 ? 0 : n % 10;
  return last === 1 ? "год" : last >= 2 && last <= 4 ? "года" : "лет";
};

const formatLine = (psy: PosterPsy) =>
  psy.format === "offline" ? `очно${psy.city ? `, ${psy.city}` : ""}` : psy.format === "both" ? `онлайн и очно${psy.city ? `, ${psy.city}` : ""}` : "онлайн";

export function WindowsPoster({ psy, days, span, onSpan, onPick, footer }: {
  psy: PosterPsy;
  days: FreeDay[];
  span: Span;
  onSpan?: (span: Span) => void;
  onPick?: (ymd: string) => void;
  footer?: ReactNode;
}) {
  const portrait = psy.portrait ? asset(psy.portrait) : "";
  const role = psy.specialistTypes?.length ? psy.specialistTypes.join(" · ") : "Психолог";

  return (
    <div className="overflow-hidden rounded-[22px] p-4" style={{ background: "var(--tiffany-soft)" }}>
      <div className="flex items-center gap-3">
        {portrait ? (
          <div className="relative h-[104px] w-[92px] shrink-0 overflow-hidden rounded-[16px]" style={{ background: "#fff" }}>
            <Image src={portrait} alt={`Портрет: ${psy.name}`} fill sizes="92px" className="object-cover" unoptimized={isInlineImage(portrait)} />
          </div>
        ) : (
          <span className="ico ico-white h-[92px] w-[92px] shrink-0 rounded-[16px]"><Icon name="user" width={38} weight="fill" color="var(--tiffany-edge)" /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="t-micro">Свободное время {SPAN_LABEL[span]}</p>
          <p className="t-title mt-0.5 flex items-center gap-1.5 leading-tight">
            <span className="truncate">{psy.name}</span>
            {psy.verified && <Icon name="seal" width={17} weight="fill" color="var(--green)" className="shrink-0" />}
          </p>
          <p className="mt-0.5 text-[11.5px] font-black" style={{ color: "var(--tiffany-edge)" }}>{role}</p>
          <p className="t-cap mt-0.5 truncate">
            {[psy.method, psy.years ? `${psy.years} ${yearsWord(psy.years)} практики` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {onSpan && (
        <div className="mt-3 flex gap-1.5">
          {(["week", "next"] as Span[]).map((value) => (
            <button
              key={value}
              onClick={() => { select(); onSpan(value); }}
              className={`flex-1 rounded-full py-1.5 text-[11.5px] font-black ${span === value ? "text-white" : ""}`}
              style={span === value ? { background: "var(--tiffany-edge)" } : { background: "#fff", color: "var(--tiffany-edge)" }}
            >
              {value === "week" ? "Ближайшие дни" : "Следующая неделя"}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {days.length === 0 ? (
          <div className="card-nested p-3.5 text-center">
            <p className="t-sub">Свободных окон {SPAN_LABEL[span]} нет</p>
          </div>
        ) : days.map((day) => (
          <div key={day.ymd} className="card-nested p-3">
            <p className="text-[11.5px] font-black leading-none">{day.label}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {day.times.map((time) => onPick ? (
                <button key={time} onClick={() => onPick(day.ymd)} className="chip tnum" style={{ background: "var(--tiffany-soft)" }}>{time}</button>
              ) : (
                <span key={time} className="chip tnum" style={{ background: "var(--tiffany-soft)" }}>{time}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(psy.price ?? 0) > 0 && (
        <p className="t-cap mt-2.5 px-1">
          {formatMoney(psy.price ?? 0, psy.currency ?? "RUB")} за {psy.minutes ?? 50} минут · {formatLine(psy)}
        </p>
      )}

      {footer}
    </div>
  );
}

/* --- Картинка для сторис: та же афиша, нарисованная на canvas --- */

const W = 1080;
const H = 1920;
const PAD = 72;

const css = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

const head = (weight: number, size: number) => `${weight} ${size}px Nunito, system-ui, sans-serif`;
const body = (weight: number, size: number) => `${weight} ${size}px "Golos Text", system-ui, sans-serif`;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    if (/^https?:\/\//i.test(src) && !src.startsWith(window.location.origin)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Рисует афишу 1080×1920 и отдаёт её как data-URL. JPEG нужен для пересылки:
 * он весит втрое меньше PNG, а фон афиши сплошной — терять на нём нечего.
 */
export async function posterPng(psy: PosterPsy, days: FreeDay[], span: Span, link: string, type: "image/png" | "image/jpeg" = "image/png"): Promise<string | null> {
  return drawPoster(psy, days, span, link, type, false);
}

async function drawPoster(psy: PosterPsy, days: FreeDay[], span: Span, link: string, type: "image/png" | "image/jpeg", retry: boolean): Promise<string | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const soft = css("--tiffany-soft", "#dceeeb");
  const edge = css("--tiffany-edge", "#2f7d74");
  const ink = css("--ink", "#221f1c");
  const muted = css("--muted", "#7c7268");

  ctx.fillStyle = soft;
  ctx.fillRect(0, 0, W, H);

  // Заголовок афиши: название платформы и адрес. Картинку пересылают дальше
  // без всякого текста, и она обязана сама говорить, откуда она.
  ctx.textAlign = "center";
  ctx.font = head(900, 46);
  ctx.fillStyle = ink;
  ctx.fillText(APP_NAME, W / 2, PAD + 46);
  ctx.font = body(700, 30);
  ctx.fillStyle = edge;
  ctx.fillText(APP_SITE, W / 2, PAD + 92);
  ctx.textAlign = "left";

  // Шапка: портрет и имя
  const headTop = PAD + 120;
  const headH = 300;
  ctx.fillStyle = "#fff";
  roundRect(ctx, PAD, headTop, W - PAD * 2, headH, 44);
  ctx.fill();

  const portraitW = 200;
  const portraitH = 224;
  const px = PAD + 40;
  const py = headTop + (headH - portraitH) / 2;
  // Портрет — единственное место, где афиша зависит от внешнего файла: он
  // может не загрузиться, прийти без CORS-заголовков и «испачкать» холст, и
  // тогда toDataURL бросит SecurityError. Поэтому неудача здесь — не повод
  // остаться без картинки: рисуем букву вместо снимка.
  const img = psy.portrait ? await loadImage(asset(psy.portrait)).catch(() => null) : null;
  ctx.save();
  roundRect(ctx, px, py, portraitW, portraitH, 28);
  ctx.clip();
  if (img) {
    const scale = Math.max(portraitW / img.width, portraitH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, px + (portraitW - dw) / 2, py + (portraitH - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = soft;
    ctx.fillRect(px, py, portraitW, portraitH);
    ctx.fillStyle = edge;
    ctx.font = head(900, 96);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(psy.name.charAt(0).toUpperCase(), px + portraitW / 2, py + portraitH / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  const tx = px + portraitW + 36;
  const textW = W - PAD - 40 - tx;
  ctx.fillStyle = muted;
  ctx.font = head(900, 26);
  ctx.fillText(`СВОБОДНОЕ ВРЕМЯ ${SPAN_LABEL[span].toUpperCase()}`, tx, py + 40);
  ctx.fillStyle = ink;
  ctx.font = head(900, 52);
  ctx.fillText(fit(ctx, psy.name, textW), tx, py + 108);
  ctx.fillStyle = edge;
  ctx.font = head(800, 30);
  ctx.fillText(fit(ctx, psy.specialistTypes?.length ? psy.specialistTypes.join(" · ") : "Психолог", textW), tx, py + 156);
  ctx.fillStyle = muted;
  ctx.font = body(600, 28);
  const sub = [psy.method, psy.years ? `${psy.years} ${yearsWord(psy.years)} практики` : ""].filter(Boolean).join(" · ");
  if (sub) ctx.fillText(fit(ctx, sub, textW), tx, py + 202);

  // Дни с окнами. Времена переносятся на следующую строку, а карточка растёт
  // под них: день на афише показывается целиком, без «+3» в углу.
  let y = headTop + headH + 44;
  const cardW = W - PAD * 2;
  const footerH = 180;
  const footerTop = H - PAD - footerH;
  const chipH = 48;
  const gap = 12;
  const innerW = cardW - 72;
  for (const day of days) {
    ctx.font = head(800, 30);
    const rows: { time: string; w: number }[][] = [];
    let row: { time: string; w: number }[] = [];
    let rowW = 0;
    for (const time of day.times) {
      const w = ctx.measureText(time).width + 44;
      if (row.length && rowW + w > innerW) { rows.push(row); row = []; rowW = 0; }
      row.push({ time, w });
      rowW += w + gap;
    }
    if (row.length) rows.push(row);

    const cardH = 84 + rows.length * chipH + (rows.length - 1) * gap + 24;
    if (y + cardH > footerTop - 24) break;
    ctx.fillStyle = "#fff";
    roundRect(ctx, PAD, y, cardW, cardH, 36);
    ctx.fill();

    ctx.fillStyle = ink;
    ctx.font = head(900, 32);
    ctx.fillText(day.label, PAD + 36, y + 56);

    ctx.font = head(800, 30);
    rows.forEach((line, ri) => {
      let cx = PAD + 36;
      const cy = y + 84 + ri * (chipH + gap);
      for (const chip of line) {
        ctx.fillStyle = soft;
        roundRect(ctx, cx, cy, chip.w, chipH, 24);
        ctx.fill();
        ctx.fillStyle = edge;
        ctx.fillText(chip.time, cx + 22, cy + 33);
        cx += chip.w + gap;
      }
    });
    y += cardH + 16;
  }

  if (days.length === 0) {
    ctx.fillStyle = muted;
    ctx.font = body(600, 32);
    ctx.fillText("Окна открываются — напишите, подберём время", PAD + 8, y + 40);
  }

  // Подвал. Ссылку убрали: картинку пересылают, по адресу в ней всё равно никто
  // не переходит руками — она подписывает, что показано выше.
  ctx.fillStyle = ink;
  roundRect(ctx, PAD, footerTop, cardW, footerH, 44);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = head(900, 48);
  ctx.textAlign = "center";
  ctx.fillText(fit(ctx, "Свободные окна для записи", cardW - 80), W / 2, footerTop + footerH / 2 + 16);
  ctx.textAlign = "left";

  try {
    return type === "image/jpeg" ? canvas.toDataURL(type, 0.92) : canvas.toDataURL(type);
  } catch {
    // Холст испорчен снимком с чужого домена — перерисовываем без него.
    if (retry) return null;
    return drawPoster({ ...psy, portrait: undefined }, days, span, link, type, true);
  }
}

/* --- Обложка приглашения: карточка специалиста над текстом сообщения --- */

const CW = 1080;
const CH = 720;

/**
 * Обложка к приглашению. Уходит картинкой над текстом: портрет, имя и подпись
 * «Хроники» узнаются раньше, чем человек начнёт читать список окон, а голое
 * сообщение со ссылкой в чате выглядит как спам.
 */
export async function coverJpeg(psy: PosterPsy): Promise<string | null> {
  return drawCover(psy, false);
}

async function drawCover(psy: PosterPsy, retry: boolean): Promise<string | null> {
  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const soft = css("--tiffany-soft", "#dceeeb");
  const edge = css("--tiffany-edge", "#2f7d74");
  const ink = css("--ink", "#221f1c");
  const muted = css("--muted", "#7c7268");

  ctx.fillStyle = soft;
  ctx.fillRect(0, 0, CW, CH);

  const r = 128;
  const cx = CW / 2;
  const cy = 190;
  const img = psy.portrait ? await loadImage(asset(psy.portrait)).catch(() => null) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#fff";
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (img) {
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = edge;
    ctx.font = head(900, 118);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(psy.name.charAt(0).toUpperCase() || "?", cx, cy);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = head(900, 58);
  ctx.fillText(fit(ctx, psy.name, CW - 160), cx, 410);

  ctx.fillStyle = edge;
  ctx.font = head(800, 32);
  ctx.fillText(fit(ctx, psy.specialistTypes?.length ? psy.specialistTypes.join(" · ") : "Психолог", CW - 160), cx, 462);

  const sub = [psy.method, psy.years ? `${psy.years} ${yearsWord(psy.years)} практики` : ""].filter(Boolean).join(" · ");
  if (sub) {
    ctx.fillStyle = muted;
    ctx.font = body(600, 28);
    ctx.fillText(fit(ctx, sub, CW - 160), cx, 508);
  }

  const barH = 112;
  const barY = CH - 64 - barH;
  ctx.fillStyle = ink;
  roundRect(ctx, 64, barY, CW - 128, barH, 42);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = head(900, 34);
  ctx.fillText("Запись на сессию", cx, barY + 50);
  ctx.fillStyle = soft;
  ctx.font = body(600, 26);
  ctx.fillText(`${APP_NAME} · ${APP_SITE}`, cx, barY + 88);
  ctx.textAlign = "left";

  try {
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    // Портрет с чужого домена испортил холст — рисуем с буквой вместо снимка.
    if (retry) return null;
    return drawCover({ ...psy, portrait: undefined }, true);
  }
}

/** Обрезает строку многоточием, чтобы она влезла в отведённую ширину. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export function downloadPng(dataUrl: string, name: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Отдать готовую афишу человеку. Внутри Telegram ссылка с `download` не
 * работает вовсе — WebView её проглатывает, и кнопка выглядела сломанной.
 * Поэтому сначала пробуем системный лист «Поделиться» с самим файлом (там
 * Telegram стоит первым пунктом), и только если его нет — сохраняем файлом.
 *
 * Возвращает, что удалось сделать: по этому виду экран объясняет, куда делась
 * картинка.
 */
export async function sharePoster(dataUrl: string, name: string): Promise<"shared" | "saved" | "shown"> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], name, { type: blob.type || "image/jpeg" });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (typeof navigator.share === "function" && nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return "shared";
    }
  } catch {
    // Отмена в системном листе — не ошибка: картинка осталась на экране.
    return "shown";
  }
  try {
    downloadPng(dataUrl, name);
    return "saved";
  } catch {
    return "shown";
  }
}
