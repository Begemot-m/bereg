import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { grantPsychologist, hasRole, rolesOf } from "@/lib/server/roles";
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
    if (!hasRole(user, "psychologist")) {
      await grantPsychologist(user.id);
      await audit(req, { userId: user.id, action: "psy.role.claim" });
    }
    return NextResponse.json({ role: "psychologist", roles: [...new Set([...rolesOf(user), "psychologist"])] });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
