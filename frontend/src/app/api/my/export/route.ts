import { NextResponse, type NextRequest } from "next/server";

import { clientIp } from "@/lib/server/client-ip";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { getTherapy } from "@/lib/server/therapy";

export const runtime = "nodejs";

/**
 * Право на выгрузку (ст. 14 152-ФЗ): человек забирает свои данные одним файлом.
 * Отдаём расшифрованными — это его данные, он имеет право их прочитать.
 * Чужого сюда не попадает: заметки психолога о клиенте не выгружаются, они
 * принадлежат психологу, а не субъекту карточки.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const [profile, cards, myAppointments, consents] = await Promise.all([
      prisma.psyProfile.findUnique({ where: { userId: user.id } }),
      prisma.client.findMany({ where: { userId: user.id }, select: { id: true, name: true, createdAt: true } }),
      prisma.appointment.findMany({
        where: { client: { userId: user.id } },
        select: { startsAt: true, durationMin: true, format: true, status: true },
        orderBy: { startsAt: "asc" },
      }),
      prisma.consent.findMany({
        where: { userId: user.id },
        select: { kind: true, policyVersion: true, grantedAt: true, revokedAt: true },
      }),
    ]);

    const therapy = await Promise.all(cards.map((c) => getTherapy(c.id)));

    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        firstName: user.firstName,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
      psyProfile: profile ? { ...(profile.data as object), name: profile.name, status: profile.status } : null,
      appointments: myAppointments,
      therapy,
      consents,
    };

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "export",
        ip: clientIp(req),
      },
    });

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
