import { NextResponse, type NextRequest } from "next/server";

import { getOverrides, horizon, setOverride, type SlotFormat } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    // Интерфейс показывает недавнее прошлое и три месяца вперёд — дальше
    // корректировки окон никому не видны.
    return NextResponse.json(await getOverrides(user.id, horizon(90, 30)));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as { iso?: string; removed?: boolean; fmt?: SlotFormat; added?: boolean; dur?: number };
    if (!body.iso) return NextResponse.json({ error: "iso required" }, { status: 422 });
    if (body.fmt && body.fmt !== "online" && body.fmt !== "offline") {
      return NextResponse.json({ error: "invalid fmt" }, { status: 422 });
    }

    // Разовое окно длиннее четырёх часов — почти наверняка опечатка.
    const dur = body.dur === undefined ? undefined : Math.min(240, Math.max(15, Math.trunc(Number(body.dur) || 0)));
    const patch = {
      ...(body.removed !== undefined ? { removed: Boolean(body.removed) } : {}),
      ...(body.fmt !== undefined ? { fmt: body.fmt } : {}),
      ...(body.added !== undefined ? { added: Boolean(body.added) } : {}),
      ...(dur !== undefined ? { dur } : {}),
    };
    return NextResponse.json(await setOverride(user.id, body.iso, patch));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof Error && e.message === "invalid iso") {
      return NextResponse.json({ error: "invalid iso" }, { status: 422 });
    }
    throw e;
  }
}
