// Общее для роутов модуля «Группы и пары». Живёт вне app/api: из route.ts
// Next разрешает экспортировать только обработчики.

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
      attendance: { select: { memberId: true, present: true } },
    },
  },
} as const;
