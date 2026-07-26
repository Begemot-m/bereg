import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Проверка живости для деплоя и мониторинга.
 *
 * Проверяем не только «процесс поднялся», но и что база отвечает: контейнер,
 * который стартовал без доступа к БД, для пользователя всё равно сломан —
 * и деплой должен откатиться, а не считаться успешным.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json({ ok: false, db: "unreachable" }, { status: 503 });
  }
  return NextResponse.json({
    ok: true,
    db: "ok",
    build: process.env.NEXT_PUBLIC_BUILD ?? null,
    latencyMs: Date.now() - startedAt,
  });
}
