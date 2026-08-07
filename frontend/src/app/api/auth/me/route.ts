import { NextResponse, type NextRequest } from "next/server";

import { psyStatusOf, rolesOf } from "@/lib/server/roles";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      // role — для старого фронта, пока идёт переход на массив ролей.
      role: user.role,
      roles: rolesOf(user),
      psyStatus: psyStatusOf(user),
      // Интерфейс по этому флагу решает, показывать ли вход в админку.
      // Права всё равно проверяются на сервере: скрытая кнопка — не защита.
      isAdmin: user.isAdmin && user.username?.replace(/^@/, "").toLowerCase() === "mmgorba",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
