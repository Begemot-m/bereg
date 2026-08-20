"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

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

export type Span = "week" | "month";

const HORIZON: Record<Span, number> = { week: 7, month: 30 };
const MAX_DAYS: Record<Span, number> = { week: 5, month: 8 };
const MAX_TIMES = 5;

const dayF = zoneFormat({ weekday: "short", day: "numeric", month: "long" });
const timeF = zoneFormat({ hour: "2-digit", minute: "2-digit" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type FreeDay = { ymd: string; label: string; times: string[]; more: number };

/** Ссылка на афишу окон: метку `win_<id>` разбирает StartRoute. */
export const windowsInviteUrl = (psyId?: number | null) => botStartLink(`win_${psyId || OWN_PROFILE_ID}`);

export function useFreeWindows(psyId: number | null | undefined, span: Span) {
  const { data: avail, isLoading: daysLoading } = useQuery({
    queryKey: ["month-avail", psyId ?? null],
    queryFn: () => getMonthAvailability(psyId),
  });

  const today = ymdLocal(new Date());
  const until = addDays(today, HORIZON[span]);
  const days = Object.keys(avail ?? {})
    .filter((d) => d >= today && d <= until && avail?.[d] === "free")
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
