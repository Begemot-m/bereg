import { NextResponse, type NextRequest } from "next/server";

import { getOverrides, getWorkHours, slotsFor, takenTimes } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const date = new URL(req.url).searchParams.get("date");
    if (!date) return NextResponse.json({ error: "date required" }, { status: 422 });

    // Окна считаются на один день — читаем сутки вокруг него, а не всю
    // историю записей и корректировок.
    const day = new Date(`${date}T00:00:00`);
    if (Number.isNaN(day.getTime())) return NextResponse.json({ error: "invalid date" }, { status: 422 });
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const range = { from: day, to: next };

    const [work, overrides, taken] = await Promise.all([
      getWorkHours(user.id),
      getOverrides(user.id, range),
      takenTimes(user.id, range),
    ]);
    return NextResponse.json(slotsFor(work, date, taken, overrides));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
