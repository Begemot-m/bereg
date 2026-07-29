import { NextResponse, type NextRequest } from "next/server";

import { getOverrides, getWorkHours, monthAvailability, takenTimes } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const [work, overrides, taken] = await Promise.all([
      getWorkHours(user.id),
      getOverrides(user.id),
      takenTimes(user.id),
    ]);
    return NextResponse.json(monthAvailability(work, taken, overrides));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
