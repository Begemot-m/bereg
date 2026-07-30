import { NextResponse, type NextRequest } from "next/server";

import { getOverrides, getWorkHours, horizon, monthAvailability, takenTimes } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    // monthAvailability считает ровно 60 дней вперёд — столько и читаем.
    const range = horizon(60);
    const [work, overrides, taken] = await Promise.all([
      getWorkHours(user.id),
      getOverrides(user.id, range),
      takenTimes(user.id, range),
    ]);
    return NextResponse.json(monthAvailability(work, taken, overrides));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
