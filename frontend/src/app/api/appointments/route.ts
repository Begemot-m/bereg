import { NextResponse, type NextRequest } from "next/server";

import { NOT_APPROVED, psyApproved } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { queueTelegramEvent, replaceClientReminders } from "@/lib/server/telegram-delivery";

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
      format?: string;
    };
    const clientId = body.clientId;

    if (!clientId || !body.startsAt) {
      return NextResponse.json({ error: "clientId and startsAt required" }, { status: 422 });
    }

    if (!(await psyApproved(user.id))) {
      return NextResponse.json(NOT_APPROVED, { status: 403 });
    }

    // Клиент должен принадлежать этому психологу — защита от IDOR.
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.psychologistId !== user.id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "invalid startsAt" }, { status: 422 });
    }

    const appt = await prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({
        data: {
          psychologistId: user.id,
          clientId,
          startsAt,
          durationMin: body.durationMin ?? 60,
          format: body.format === "offline" ? "offline" : "online",
          note: body.note ?? "",
        },
        include: { client: { select: { id: true, name: true } } },
      });
      if (client.userId) {
        const clientUser = await tx.user.findUnique({ where: { id: client.userId }, select: { sessionReminder2h: true } });
        await queueTelegramEvent(tx, { appointmentId: created.id, recipientId: client.userId, audience: "client", kind: "booking" });
        await replaceClientReminders(tx, {
          appointmentId: created.id,
          clientUserId: client.userId,
          startsAt,
          reminder2h: clientUser?.sessionReminder2h ?? false,
        });
      }
      return created;
    });
    return NextResponse.json(appt, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
