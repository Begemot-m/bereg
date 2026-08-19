// Общее для роутов модуля «Группы и пары». Живёт вне app/api: из route.ts
// Next разрешает экспортировать только обработчики.

import { NextResponse } from "next/server";

import { GROUPS_LIVE } from "@/lib/modules";
import { prisma } from "@/lib/server/prisma";

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
  posts: {
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, kind: true, text: true, reach: true, createdAt: true },
  },
} as const;

/**
 * Одно изменение в группе — одно сообщение всем участникам сразу: запись
 * ложится в ленту (ведущий видит, что именно ушло) и считает охват. Рассылку в
 * Telegram подхватывает бот напоминаний по этим же записям.
 */
export async function announce(groupId: number, kind: "post" | "event", text: string) {
  const reach = await prisma.groupMember.count({ where: { groupId, status: "active" } });
  return prisma.groupPost.create({ data: { groupId, kind, text, reach } });
}

export const whenRu = (at: Date) =>
  at.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
