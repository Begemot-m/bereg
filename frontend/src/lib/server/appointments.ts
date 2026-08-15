import { prisma } from "@/lib/server/prisma";

/**
 * Прошедшая встреча становится состоявшейся сама.
 *
 * Отметки «сессия проведена» в интерфейсе нет и не планировалось: психолог
 * ничего не нажимает, а запись так и висела `scheduled` навсегда. От этого
 * статуса зависит слишком многое — «проведено» в карточке клиента, статистика
 * работы, счётчики в каталоге и старт 14 дней PRO, — и всё это стояло в нулях
 * при полном расписании.
 *
 * Считаем состоявшейся встречу, время которой вышло целиком (начало плюс
 * длительность). Отменённые не трогаем: их отменили осознанно.
 */
export function settlePastAppointments(psychologistId?: number) {
  return psychologistId
    ? prisma.$executeRaw`
        UPDATE "Appointment"
        SET "status" = 'done'
        WHERE "psychologistId" = ${psychologistId}
          AND "status" = 'scheduled'
          AND "startsAt" + ("durationMin" * INTERVAL '1 minute') < now()`
    : prisma.$executeRaw`
        UPDATE "Appointment"
        SET "status" = 'done'
        WHERE "status" = 'scheduled'
          AND "startsAt" + ("durationMin" * INTERVAL '1 minute') < now()`;
}
