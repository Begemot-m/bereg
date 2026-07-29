import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Колокольчик. Отдаём последние полсотни: дальше вглубь никто не листает,
// а тянуть всю историю каждый раз — лишняя работа для базы.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const list = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      unread: list.filter((n) => !n.readAt).length,
      items: list.map((n) => ({
        id: n.id,
        kind: n.kind,
        text: n.text,
        createdAt: n.createdAt.toISOString(),
        read: Boolean(n.readAt),
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
