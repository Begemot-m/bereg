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
 *
 * Сравниваем с `now() AT TIME ZONE 'UTC'`, а не с голым `now()`. Колонка —
 * `timestamp(3)` без зоны, и Prisma пишет в неё UTC; голый `now()` — это
 * `timestamptz`, и Postgres приводил колонку к зоне сессии. На сервере с
 * ненулевым TimeZone встреча «состоялась» на несколько часов раньше срока и
 * пропадала из расписания у обеих сторон в самый день сессии.
 */
export function settlePastAppointments(psychologistId?: number) {
  return psychologistId
    ? prisma.$executeRaw`
        UPDATE "Appointment"
        SET "status" = 'done'
        WHERE "psychologistId" = ${psychologistId}
          AND "status" = 'scheduled'
          AND "startsAt" + ("durationMin" * INTERVAL '1 minute') < (now() AT TIME ZONE 'UTC')`
    : prisma.$executeRaw`
        UPDATE "Appointment"
        SET "status" = 'done'
        WHERE "status" = 'scheduled'
          AND "startsAt" + ("durationMin" * INTERVAL '1 minute') < (now() AT TIME ZONE 'UTC')`;
}
