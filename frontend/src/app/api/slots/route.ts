import { NextResponse, type NextRequest } from "next/server";

import { getOverrides, getWorkHours, resolveScheduleOwner, slotsFor, takenTimes } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const params = new URL(req.url).searchParams;
    const date = params.get("date");
    if (!date) return NextResponse.json({ error: "date required" }, { status: 422 });

    // psy=<id> — окна специалиста, к которому записывается клиент.
    const owner = await resolveScheduleOwner(user.id, params.get("psy"));
    if (!owner) return NextResponse.json({ error: "Psychologist not found" }, { status: 404 });

    // Окна считаются на один день — читаем сутки вокруг него, а не всю
    // историю записей и корректировок.
    const day = new Date(`${date}T00:00:00`);
    if (Number.isNaN(day.getTime())) return NextResponse.json({ error: "invalid date" }, { status: 422 });
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const range = { from: day, to: next };

    const [work, overrides, taken] = await Promise.all([
      getWorkHours(owner),
      getOverrides(owner, range),
      takenTimes(owner, range),
    ]);
    return NextResponse.json(slotsFor(work, date, taken, overrides, owner !== user.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
