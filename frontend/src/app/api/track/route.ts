import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { limited, LIMITS } from "@/lib/server/rate-limit";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

/** Разделы приложения. Чужое значение в базу не пускаем — иначе сводка мусорная. */
const SECTIONS = new Set([
  "home", "sessions", "clients", "catalog", "cabinet", "tools",
  "therapy", "profile", "admin", "landing", "onboarding", "support",
]);

const ROLES = new Set(["psychologist", "client", "guest"]);

/**
 * Заход в раздел. Пишет приложение при смене экрана — не чаще раза в пять
 * минут на связку устройство+раздел, поэтому строк немного, а «сколько людей
 * заходило и куда» наконец видно.
 *
 * Роут открыт без авторизации: гость каталога тоже человек, которого надо
 * посчитать. Кто вошёл — определяем по куке.
 */
export async function POST(req: NextRequest) {
  const stop = limited(req, "track", LIMITS.write);
  if (stop) return stop;

  const body = (await req.json().catch(() => ({}))) as { section?: string; device?: string; role?: string };
  const section = String(body.section ?? "");
  const device = String(body.device ?? "").slice(0, 64);
  if (!SECTIONS.has(section) || !device) return NextResponse.json({ ok: false }, { status: 422 });

  let userId: number | null = null;
  let role = ROLES.has(String(body.role)) ? String(body.role) : "guest";
  try {
    const user = await requireUser(req);
    userId = user.id;
    // Роль берём из базы, а не из тела запроса: подписать себя психологом
    // в статистике не должно быть можно.
    role = user.roles.includes("psychologist") ? "psychologist" : "client";
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
  }

  await prisma.visit.create({ data: { userId, role, section, device } });
  return NextResponse.json({ ok: true });
}
