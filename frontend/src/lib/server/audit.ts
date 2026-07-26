import type { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";

/**
 * Журнал действий с персональными данными.
 *
 * Пишем факт и контекст, но не сами данные: в журнал не должны попадать
 * ни настроение, ни заметки, ни содержимое карточек — иначе он сам
 * становится хранилищем ПД со всеми требованиями к нему.
 *
 * Ошибку записи глушим: аудит не должен ронять пользовательский сценарий,
 * но и молчать не должен — пишем в stderr, чтобы это увидел мониторинг.
 */
export async function audit(
  req: NextRequest,
  entry: {
    userId?: number | null;
    action: string;
    entity?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  },
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        meta: (entry.meta ?? {}) as object,
        userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
      },
    });
  } catch (error) {
    console.error("[audit] не удалось записать событие", entry.action, error);
  }
}
