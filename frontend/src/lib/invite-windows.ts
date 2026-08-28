"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { botStartLink } from "@/lib/brand";
import { OWN_PROFILE_ID } from "@/lib/catalog";
import { getMonthAvailability, getSlots, ymdLocal } from "@/lib/schedule";
import { addDays, zoneDay, zoneFormat } from "@/lib/zone";

/**
 * Свободные окна для афиши-приглашения. Считаются из того же графика, что и
 * запись: сперва дни с окнами (месячная доступность), потом времена по этим
 * дням. Дней берём немного — афишу читают с телефона, длинный список в неё не
 * помещается и не убеждает.
 */

/**
 * Охват афиши. `week` — ближайшие семь дней от дня отправки, `next` — целиком
 * следующая календарная неделя: её просят, когда текущая уже забита или идёт к
 * концу. Месяц убрали — на афише он не читался, а окна за три недели вперёд
 * всё равно успевали разойтись.
 */
export type Span = "week" | "next";

const HORIZON: Record<Span, number> = { week: 7, next: 14 };
const MAX_DAYS: Record<Span, number> = { week: 5, next: 5 };
const MAX_TIMES = 5;

const dayF = zoneFormat({ weekday: "short", day: "numeric", month: "long" });
const timeF = zoneFormat({ hour: "2-digit", minute: "2-digit" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type FreeDay = { ymd: string; label: string; times: string[]; more: number };

/** Ссылка на афишу окон: метку `win_<id>` разбирает StartRoute. */
export const windowsInviteUrl = (psyId?: number | null) => botStartLink(`win_${psyId || OWN_PROFILE_ID}`);

const SPAN_WORD: Record<Span, string> = { week: "на ближайшую неделю", next: "на следующую неделю" };

/**
 * Готовое сообщение клиенту: приветствие, свободные окна списком и просьба
 * выбрать время. Специалисту не надо ничего сочинять — текст копируется вместе
 * со ссылкой и отправляется как есть.
 */
export function inviteMessage(name: string, days: FreeDay[], span: Span): string {
  const hi = name ? `Здравствуйте! Это ${name}.` : "Здравствуйте!";
  const call = "Чтобы выбрать удобное время и записаться, перейдите на платформу:";
  if (!days.length) {
    return `${hi}\n\nБлижайшие свободные окна для записи на сессии появятся в расписании.\n${call}`;
  }
  const lines = days.map((d) => `• ${d.label} — ${d.times.join(", ")}${d.more ? ` и ещё ${d.more}` : ""}`);
  return [
    hi,
    "",
    "Ближайшие свободные окна для записи на сессии:",
    ...lines,
    "",
    call,
  ].join("\n");
}

export function useFreeWindows(psyId: number | null | undefined, span: Span) {
  const { data: avail, isLoading: daysLoading } = useQuery({
    queryKey: ["month-avail", psyId ?? null],
    queryFn: () => getMonthAvailability(psyId),
  });

  const today = ymdLocal(new Date());
  // Следующая неделя считается от ближайшего понедельника: «следующая» для
  // человека — это календарная неделя, а не «через семь дней».
  const shift = span === "next" ? (8 - (zoneDay(today).getDay() || 7)) % 7 || 7 : 0;
  const from = addDays(today, shift);
  const until = span === "next" ? addDays(from, 6) : addDays(today, HORIZON[span]);
  const days = Object.keys(avail ?? {})
    .filter((d) => d >= from && d <= until && avail?.[d] === "free")
    .sort()
    .slice(0, MAX_DAYS[span]);

  const slots = useQueries({
    queries: days.map((d) => ({ queryKey: ["slots", d, psyId ?? null], queryFn: () => getSlots(d, psyId) })),
  });

  const result: FreeDay[] = days
    .map((ymd, i) => {
      const free = (slots[i]?.data ?? []).filter((s) => !s.taken);
      return {
        ymd,
        label: cap(dayF.format(zoneDay(ymd))),
        times: free.slice(0, MAX_TIMES).map((s) => timeF.format(new Date(s.start))),
        more: Math.max(0, free.length - MAX_TIMES),
      };
    })
    .filter((d) => d.times.length > 0);

  return {
    days: result,
    loading: daysLoading || slots.some((q) => q.isLoading),
    total: result.reduce((sum, d) => sum + d.times.length + d.more, 0),
  };
}


/**
 * Готовит сообщение с кнопкой и отдаёт его id для `shareMessage`. В демо и на
 * старых клиентах роут отвечает ошибкой — приглашение уходит ссылкой, как
 * раньше.
 */
export const prepareInviteMessage = (text: string, link: string, button = "Записаться на сессию") =>
  apiFetch<{ id: string }>("/invite/prepared", { method: "POST", body: JSON.stringify({ text, link, button }) });
