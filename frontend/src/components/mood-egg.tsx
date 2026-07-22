"use client";

import { motion } from "motion/react";
import { useId } from "react";

// Персонаж-яйцо: мимика плавно едет от 1 (тяжело) к 5 (отлично).
// value — дробное 1..5, чтобы лицо менялось прямо во время кручения диска.
export function MoodEgg({ value, size = 180, still }: { value: number; size?: number; still?: boolean }) {
  const gradientId = `egg-${useId()}`;
  const t = Math.min(1, Math.max(0, (value - 1) / 4)); // 0..1
  const fill = mix(t);

  // Рот: спокойная дуга — от лёгкой грусти к мягкой улыбке, без гиперболы.
  const curve = -16 + t * 40; // −16 (грусть) … +24 (улыбка)
  const width = 26 + t * 12;
  const mouth = `M ${60 - width / 2} 86 Q 60 ${86 + curve} ${60 + width / 2} 86`;

  // Глаза: прищур на краях шкалы, спокойные в середине.
  const eyeH = 9 - Math.abs(t - 0.5) * 5;
  const brow = (1 - t) * 5;

  return (
    <motion.svg
      width={size}
      height={size * 1.16}
      viewBox="0 0 120 140"
      role="img"
      aria-label={`Настроение: ${Math.round(value)} из 5`}
      animate={still ? undefined : { rotate: (t - 0.5) * 6, y: (0.5 - Math.abs(t - 0.5)) * -4 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(fill)} />
          <stop offset="100%" stopColor={fill} />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="128" rx={30 - t * 4} ry="5" fill="rgba(32,28,24,.12)" />
      {/* Тело — яйцо */}
      <path
        d="M60 8 C 88 8 108 44 108 76 C 108 104 86 124 60 124 C 34 124 12 104 12 76 C 12 44 32 8 60 8 Z"
        fill={`url(#${gradientId})`}
        stroke="var(--ink)"
        strokeWidth="3"
      />
      {/* Блик */}
      <ellipse cx="40" cy="40" rx="12" ry="16" fill="#fff" opacity=".25" transform="rotate(-20 40 40)" />
      {/* Глаза */}
      <motion.g animate={{ y: brow }} transition={{ type: "spring", stiffness: 200, damping: 18 }}>
        <ellipse cx="45" cy="60" rx="5.5" ry={eyeH} fill="var(--ink)" />
        <ellipse cx="75" cy="60" rx="5.5" ry={eyeH} fill="var(--ink)" />
      </motion.g>
      {/* Щёчки — проступают при хорошем настроении */}
      <g opacity={Math.max(0, t - 0.45) * 1.8}>
        <ellipse cx="32" cy="84" rx="7" ry="5" fill="#e58a7a" opacity=".55" />
        <ellipse cx="88" cy="84" rx="7" ry="5" fill="#e58a7a" opacity=".55" />
      </g>
      {/* Рот */}
      <path d={mouth} fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
    </motion.svg>
  );
}

// Персонаж-блоб: пухлое «облако» с обводкой — для миниатюр (мимика и цвет по шкале).
export function MoodBlob({ value, size = 220, still }: { value: number; size?: number; still?: boolean }) {
  const gradientId = `blob-${useId()}`;
  const t = Math.min(1, Math.max(0, (value - 1) / 4));
  const fill = mix(t);
  const happy = smooth((t - 0.5) / 0.42);
  const sad = smooth((0.42 - t) / 0.42);
  const frown = `M 78 118 Q 100 ${112 - sad * 12} 122 118`;
  const smile = `M 74 108 Q 100 ${118 + happy * 30} 126 108 Q 100 ${118 + happy * 12} 74 108 Z`;
  const eyeGap = 30 - sad * 2;

  return (
    <motion.svg
      width={size}
      height={size * 0.86}
      viewBox="0 0 200 172"
      role="img"
      aria-label={`Настроение: ${Math.round(value)} из 5`}
      animate={still ? undefined : { y: (0.5 - Math.abs(t - 0.5)) * -5, rotate: (t - 0.5) * 3 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(fill)} />
          <stop offset="100%" stopColor={fill} />
        </linearGradient>
      </defs>
      <path
        d="M22 150 C 8 118 12 78 34 66 C 30 44 52 30 68 42 C 74 22 104 20 112 42 C 130 28 158 40 152 66 C 176 74 178 116 160 138 C 168 150 150 168 100 168 C 52 168 28 168 22 150 Z"
        fill={`url(#${gradientId})`}
        stroke="var(--ink)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <ellipse cx="60" cy="70" rx="16" ry="20" fill="#fff" opacity=".22" transform="rotate(-18 60 70)" />
      <g>
        <ellipse cx={100 - eyeGap} cy="92" rx="17" ry="18" fill="#fff" stroke="var(--ink)" strokeWidth="3.5" />
        <ellipse cx={100 + eyeGap} cy="92" rx="17" ry="18" fill="#fff" stroke="var(--ink)" strokeWidth="3.5" />
        <circle cx={100 - eyeGap} cy={94 - happy * 3} r="7.5" fill="var(--ink)" />
        <circle cx={100 + eyeGap} cy={94 - happy * 3} r="7.5" fill="var(--ink)" />
        <g opacity={happy}>
          <path d={`M ${100 - eyeGap - 15} 94 Q ${100 - eyeGap} 78 ${100 - eyeGap + 15} 94`} fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
          <path d={`M ${100 + eyeGap - 15} 94 Q ${100 + eyeGap} 78 ${100 + eyeGap + 15} 94`} fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
        </g>
      </g>
      <g opacity={happy}>
        <ellipse cx="62" cy="116" rx="11" ry="7" fill="#e58a7a" opacity=".55" />
        <ellipse cx="138" cy="116" rx="11" ry="7" fill="#e58a7a" opacity=".55" />
      </g>
      <path d={frown} fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" opacity={1 - happy} />
      <path d={smile} fill="var(--ink)" opacity={happy} />
    </motion.svg>
  );
}

// Голова-блок для окна настроения: облако-крона ВО ВСЮ ШИРИНУ, без обводки —
// заливка = цвет страницы, контур головы = верхняя граница блока.
// Лицо статичное: меняются только рот и цвет, плавно по шкале.
export function MoodHead({ value }: { value: number }) {
  const t = Math.min(1, Math.max(0, (value - 1) / 4));
  const fill = mix(t);
  const cx1 = 152, cx2 = 238, cy = 122;

  // Рот: единая дуга, контрольная точка плавно едет вниз (улыбка) / вверх (грусть).
  const mx = 195, my = 176, half = 28 + t * 8;
  const ctrlY = my + (t - 0.5) * 74; // t=1 → улыбка, t=0 → грусть
  const mouth = `M ${mx - half} ${my} Q ${mx} ${ctrlY} ${mx + half} ${my}`;

  return (
    <svg viewBox="0 0 390 236" width="100%" className="block" role="img" aria-label={`Настроение: ${Math.round(value)} из 5`} style={{ height: "auto" }}>
      {/* Пять бугорков-полукругов ровно на всю ширину, бока — по краям экрана */}
      <path
        d="M0 236 L0 72 A 39 39 0 0 1 78 72 A 39 39 0 0 1 156 72 A 39 39 0 0 1 234 72 A 39 39 0 0 1 312 72 A 39 39 0 0 1 390 72 L390 236 Z"
        fill={fill}
      />
      {/* Статичные глаза — крупные белые с чёрным зрачком */}
      <circle cx={cx1} cy={cy} r="25" fill="#fff" />
      <circle cx={cx2} cy={cy} r="25" fill="#fff" />
      <circle cx={cx1} cy={cy + 2} r="11" fill="var(--ink)" />
      <circle cx={cx2} cy={cy + 2} r="11" fill="var(--ink)" />
      {/* Рот — единственная меняющаяся часть */}
      <path d={mouth} fill="none" stroke="var(--ink)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

function smooth(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

const STOPS = ["#e08a76", "#e9a978", "#e8c877", "#c9d081", "#8ec295"];

function mix(t: number): string {
  const pos = t * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(pos));
  return blend(STOPS[i], STOPS[i + 1], pos - i);
}

function blend(a: string, b: string, k: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function lighten(hex: string): string {
  return blend(hex, "#ffffff", 0.34);
}

export const moodColor = (value: number) => mix(Math.min(1, Math.max(0, (value - 1) / 4)));
