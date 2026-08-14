import { NextResponse, type NextRequest } from "next/server";

import { inviteCode } from "@/lib/server/invite-code";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Одна ссылка на всех клиентов сразу: карточку по ней заводит сам переход, а
// не психолог заранее. Код подписан и не истекает — ссылку кладут в переписку
// и в описание профиля, там она должна работать долго.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({ token: await inviteCode("psy", user.id) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
