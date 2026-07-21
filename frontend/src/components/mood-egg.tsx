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
