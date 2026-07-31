import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { replaceClientReminders } from "@/lib/server/telegram-delivery";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const schema = z.object({ reminder2h: z.boolean() });

const dto = (reminder2h: boolean) => ({ reminder24h: true as const, reminder2h });

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json(dto(user.sessionReminder2h));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await parseBody(req, schema);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { sessionReminder2h: body.reminder2h } });
      const future = await tx.appointment.findMany({
        where: { client: { userId: user.id }, status: "scheduled", startsAt: { gt: new Date() } },
        select: { id: true, startsAt: true },
      });
      for (const appointment of future) {
        await replaceClientReminders(tx, {
          appointmentId: appointment.id,
          clientUserId: user.id,
          startsAt: appointment.startsAt,
          reminder2h: body.reminder2h,
        });
      }
    });
    return NextResponse.json(dto(body.reminder2h));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
