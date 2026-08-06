import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Переход в психологи без анкеты. Раньше роль в базе поднимала только подача
// заявки; когда анкету из флоу убрали, интерфейс переключался, а на сервере
// человек оставался клиентом — и любое действие психолога отвечало отказом.
// Роль сама по себе ничего не открывает: приём клиентов и каталог по-прежнему
// ждут approved от модерации.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user.role !== "psychologist") {
      await prisma.user.update({ where: { id: user.id }, data: { role: "psychologist" } });
      await audit(req, { userId: user.id, action: "psy.role.claim" });
    }
    return NextResponse.json({ role: "psychologist" });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
