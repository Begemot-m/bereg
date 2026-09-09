import { NextResponse, type NextRequest } from "next/server";

import { LIMITS, limited } from "@/lib/server/rate-limit";
import { getOverrides, getWorkHours, horizon, monthAvailability, publicScheduleOwner, resolveScheduleOwner, takenTimes } from "@/lib/server/schedule";
import { AuthError, optionalUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await optionalUser(req);
    // psy=<id> — доступность специалиста, к которому записывается клиент.
    const psy = new URL(req.url).searchParams.get("psy");
    // Как и в /slots: гостю открыты окна конкретной анкеты, своего расписания
    // у него нет.
    if (!user && !psy) return NextResponse.json({ error: "missing token" }, { status: 401 });
    if (!user) {
      const stop = limited(req, "month-availability", LIMITS.browse);
      if (stop) return stop;
    }
    const owner = user ? await resolveScheduleOwner(user.id, psy) : await publicScheduleOwner(psy);
    if (!owner) return NextResponse.json({ error: "Psychologist not found" }, { status: 404 });
    // Как и в /slots: запрос с `psy` — это взгляд со стороны записи, правило
    // предварительной записи в нём действует даже на собственную анкету.
    const asClient = !user || Boolean(psy) || owner !== user.id;
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
