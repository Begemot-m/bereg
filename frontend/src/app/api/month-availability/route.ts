import { NextResponse, type NextRequest } from "next/server";

import { getOverrides, getWorkHours, horizon, monthAvailability, resolveScheduleOwner, takenTimes } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    // psy=<id> — доступность специалиста, к которому записывается клиент.
    const psy = new URL(req.url).searchParams.get("psy");
    const owner = await resolveScheduleOwner(user.id, psy);
    if (!owner) return NextResponse.json({ error: "Psychologist not found" }, { status: 404 });
    // Как и в /slots: запрос с `psy` — это взгляд со стороны записи, правило
    // предварительной записи в нём действует даже на собственную анкету.
    const asClient = Boolean(psy) || owner !== user.id;
    // monthAvailability считает ровно 60 дней вперёд — столько и читаем.
    const range = horizon(60);
    const [work, overrides, taken] = await Promise.all([
      getWorkHours(owner),
      getOverrides(owner, range),
      takenTimes(owner, range),
    ]);
    return NextResponse.json(monthAvailability(work, taken, overrides, asClient));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
