"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { APP_NAME } from "@/lib/brand";
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

const SPAN_LABEL: Record<Span, string> = { week: "на неделю", next: "на следующую неделю", month: "на месяц" };

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
          {(["week", "month"] as Span[]).map((value) => (
            <button
              key={value}
              onClick={() => { select(); onSpan(value); }}
              className={`flex-1 rounded-full py-1.5 text-[11.5px] font-black ${span === value ? "text-white" : ""}`}
              style={span === value ? { background: "var(--tiffany-edge)" } : { background: "#fff", color: "var(--tiffany-edge)" }}
            >
              {value === "week" ? "Неделя" : "Месяц"}
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
              {day.more > 0 && <span className="t-cap self-center">+{day.more}</span>}
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

/** Рисует афишу 1080×1920 и отдаёт её как data-URL. */
export async function posterPng(psy: PosterPsy, days: FreeDay[], span: Span, link: string): Promise<string | null> {
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

  // Шапка: портрет и имя
  const headTop = PAD + 40;
  const headH = 300;
  ctx.fillStyle = "#fff";
  roundRect(ctx, PAD, headTop, W - PAD * 2, headH, 44);
  ctx.fill();

  const portraitW = 200;
  const portraitH = 224;
  const px = PAD + 40;
  const py = headTop + (headH - portraitH) / 2;
  const img = psy.portrait ? await loadImage(asset(psy.portrait)) : null;
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

  // Дни с окнами
  let y = headTop + headH + 44;
  const cardW = W - PAD * 2;
  const footerTop = H - PAD - 240;
  for (const day of days) {
    const cardH = 156;
    if (y + cardH > footerTop - 24) break;
    ctx.fillStyle = "#fff";
    roundRect(ctx, PAD, y, cardW, cardH, 36);
    ctx.fill();

    ctx.fillStyle = ink;
    ctx.font = head(900, 32);
    ctx.fillText(day.label, PAD + 36, y + 56);

    let cx = PAD + 36;
    const cy = y + 84;
    ctx.font = head(800, 30);
    for (const time of day.times) {
      const w = ctx.measureText(time).width + 44;
      if (cx + w > PAD + cardW - 36) break;
      ctx.fillStyle = soft;
      roundRect(ctx, cx, cy, w, 48, 24);
      ctx.fill();
      ctx.fillStyle = edge;
      ctx.fillText(time, cx + 22, cy + 33);
      cx += w + 12;
    }
    if (day.more > 0) {
      ctx.fillStyle = muted;
      ctx.font = body(600, 26);
      ctx.fillText(`+${day.more}`, cx + 4, cy + 33);
    }
    y += cardH + 16;
  }

  if (days.length === 0) {
    ctx.fillStyle = muted;
    ctx.font = body(600, 32);
    ctx.fillText("Окна открываются — напишите, подберём время", PAD + 8, y + 40);
  }

  // Подвал: куда идти
  ctx.fillStyle = ink;
  roundRect(ctx, PAD, footerTop, cardW, 240, 44);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = head(900, 44);
  ctx.textAlign = "center";
  ctx.fillText("Записаться на встречу", W / 2, footerTop + 88);
  ctx.font = body(600, 30);
  ctx.fillStyle = soft;
  ctx.fillText(fit(ctx, link.replace(/^https?:\/\//, ""), cardW - 80), W / 2, footerTop + 142);
  ctx.font = head(800, 26);
  ctx.fillStyle = muted;
  ctx.fillText(`Онлайн-запись в «${APP_NAME}»`, W / 2, footerTop + 196);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
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
