import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

type ApptRow = {
  id: number;
  startsAt: Date;
  durationMin: number;
  format: string;
  psychologist: { psyProfile: { name: string } | null; firstName: string | null };
};

const toDTO = (a: ApptRow) => ({
  id: a.id,
  psyName: a.psychologist.psyProfile?.name ?? a.psychologist.firstName ?? "Специалист",
  startsAt: a.startsAt.toISOString(),
  durationMin: a.durationMin,
  format: a.format,
});

const include = { psychologist: { select: { firstName: true, psyProfile: { select: { name: true } } } } };

// Записи клиента к специалистам. Это те же Appointment, что видит психолог, —
// просто смотрим с другой стороны: через карточки, привязанные к аккаунту.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const list = await prisma.appointment.findMany({
      where: { client: { userId: user.id }, status: { not: "cancelled" } },
      orderBy: { startsAt: "asc" },
      include,
    });
    return NextResponse.json(list.map(toDTO));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as { psychologistId?: number; startsAt?: string; durationMin?: number; format?: string };

    const psychologistId = Number(body.psychologistId);
    if (!psychologistId) return NextResponse.json({ error: "psychologistId required" }, { status: 422 });
    const startsAt = new Date(String(body.startsAt));
    if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ error: "invalid startsAt" }, { status: 422 });

    const psy = await prisma.psyProfile.findUnique({ where: { userId: psychologistId } });
    if (!psy || psy.status !== "approved") {
      return NextResponse.json({ error: "Psychologist not found" }, { status: 404 });
    }

    // Занято? Проверяем на сервере: клиент мог прислать любое время.
    const busy = await prisma.appointment.findFirst({
      where: { psychologistId, startsAt, status: { not: "cancelled" } },
    });
    if (busy) return NextResponse.json({ error: "Слот уже занят" }, { status: 409 });

    // Карточка клиента у этого психолога: если её нет — заводим.
    // Так запись сразу появляется у специалиста в разделе «Клиенты».
    const card =
      (await prisma.client.findFirst({ where: { psychologistId, userId: user.id } })) ??
      (await prisma.client.create({
        data: {
          psychologistId,
          userId: user.id,
          name: user.firstName ?? "Клиент",
          link: "joined",
          status: "new",
        },
      }));

    const appt = await prisma.appointment.create({
      data: {
        psychologistId,
        clientId: card.id,
        startsAt,
        durationMin: Number(body.durationMin) || psy.sessionMinutes,
        format: body.format === "offline" ? "offline" : "online",
      },
      include,
    });
    return NextResponse.json(toDTO(appt), { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
