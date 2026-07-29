import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Отметить прочитанными. Без тела — всё; с массивом id — только их.
 * Фильтр по userId обязателен: иначе чужие id в теле гасили бы чужие
 * уведомления.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : null;

    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
