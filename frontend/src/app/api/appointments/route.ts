import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");

    // По умолчанию отдаём окно вокруг сегодняшнего дня, а не всю историю:
    // за год записей тысячи, а на экране нужны ближайшие.
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const take = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 200)));
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 3);

    const appts = await prisma.appointment.findMany({
      where: {
        psychologistId: user.id,
        ...(clientId ? { clientId: Number(clientId) } : {}),
        startsAt: {
          gte: from ? new Date(from) : defaultFrom,
          ...(to ? { lte: new Date(to) } : {}),
        },
      },
      orderBy: { startsAt: "asc" },
      include: { client: { select: { id: true, name: true } } },
      take,
    });
    return NextResponse.json(appts);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as {
      clientId?: number;
      startsAt?: string;
      durationMin?: number;
      note?: string;
    };

    if (!body.clientId || !body.startsAt) {
      return NextResponse.json({ error: "clientId and startsAt required" }, { status: 422 });
    }

    // Клиент должен принадлежать этому психологу — защита от IDOR.
    const client = await prisma.client.findUnique({ where: { id: body.clientId } });
    if (!client || client.psychologistId !== user.id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "invalid startsAt" }, { status: 422 });
    }

    const appt = await prisma.appointment.create({
      data: {
        psychologistId: user.id,
        clientId: body.clientId,
        startsAt,
        durationMin: body.durationMin ?? 60,
        note: body.note ?? "",
      },
      include: { client: { select: { id: true, name: true } } },
    });
    return NextResponse.json(appt, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
