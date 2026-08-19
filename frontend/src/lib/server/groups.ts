// Общее для роутов модуля «Группы и пары». Живёт вне app/api: из route.ts
// Next разрешает экспортировать только обработчики.

import { NextResponse } from "next/server";

import { GROUPS_LIVE } from "@/lib/modules";

/**
 * Пока модуль не открыт пользователям, его роутов для внешнего мира не
 * существует. Запирать только интерфейс мало: страницу можно обойти, а запросы
 * — послать руками.
 */
export function moduleClosed(): NextResponse | null {
  return GROUPS_LIVE ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Модуль платный, и запирать его только в интерфейсе нельзя. */
export const NEEDS_PRO_MODULE = {
  error: "needs_pro",
  message: "Группы и парная терапия входят в подписку PRO.",
} as const;

export const MEMBERS_INCLUDE = {
  members: {
    where: { status: "active" },
    orderBy: { joinedAt: "asc" },
    select: { id: true, clientId: true, name: true, status: true },
  },
  meetings: {
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      startsAt: true,
      durationMin: true,
      status: true,
      note: true,
      format: true,
      place: true,
      attendance: { select: { memberId: true, present: true } },
    },
  },
  tasks: {
    orderBy: { createdAt: "desc" },
    select: { id: true, text: true, dueAt: true, status: true, createdAt: true },
  },
} as const;
