import { NextResponse, type NextRequest } from "next/server";

import { getOverrides, getWorkHours, slotsFor, takenTimes } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const date = new URL(req.url).searchParams.get("date");
    if (!date) return NextResponse.json({ error: "date required" }, { status: 422 });

    const [work, overrides, taken] = await Promise.all([
      getWorkHours(user.id),
      getOverrides(user.id),
      takenTimes(user.id),
    ]);
    return NextResponse.json(slotsFor(work, date, taken, overrides));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
