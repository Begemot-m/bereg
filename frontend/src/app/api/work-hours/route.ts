import { NextResponse, type NextRequest } from "next/server";

import { getWorkHours, saveWorkHours, type WorkSlot } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json(await getWorkHours(user.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as {
      hours?: Record<number, WorkSlot[]>;
      sessionMinutes?: number;
      cancelLockDays?: number;
      leadDaysOffline?: number;
      leadDaysOnline?: number;
    };

    // Шаблон приходит целиком — проверяем форму, чтобы в базу не легло что попало.
    if (body.hours !== undefined) {
      const ok = Object.values(body.hours).every((list) =>
        Array.isArray(list) && list.every((s) => typeof s?.t === "string" && Number.isFinite(s?.d)),
      );
      if (!ok) return NextResponse.json({ error: "invalid hours" }, { status: 422 });
    }
    if (body.sessionMinutes !== undefined) {
      const m = Number(body.sessionMinutes);
      if (!Number.isFinite(m) || m < 15 || m > 240) {
        return NextResponse.json({ error: "invalid sessionMinutes" }, { status: 422 });
      }
    }
    if (body.cancelLockDays !== undefined) {
      const d = Number(body.cancelLockDays);
      if (!Number.isInteger(d) || d < 0 || d > 7) {
        return NextResponse.json({ error: "invalid cancelLockDays" }, { status: 422 });
      }
    }
    for (const key of ["leadDaysOffline", "leadDaysOnline"] as const) {
      if (body[key] === undefined) continue;
      const d = Number(body[key]);
      if (!Number.isInteger(d) || d < 0 || d > 30) {
        return NextResponse.json({ error: `invalid ${key}` }, { status: 422 });
      }
    }

    return NextResponse.json(await saveWorkHours(user.id, body));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
