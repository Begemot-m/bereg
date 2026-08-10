import { NextResponse, type NextRequest } from "next/server";

import { renewDueSubscriptions } from "@/lib/server/renew";

export const runtime = "nodejs";

// Дёргается по расписанию (crontab на сервере, раз в сутки):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://chronika.space/api/cron/renew
// Без секрета в окружении эндпоинт всегда отвечает 401 — публично не доступен.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await renewDueSubscriptions();
  return NextResponse.json(result);
}
