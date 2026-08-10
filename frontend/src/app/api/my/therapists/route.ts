import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

export type TherapistLinkDTO = { id: number; name: string; active: boolean };

// Закреплённые специалисты клиента. Раньше список жил в localStorage: на
// втором устройстве раздел «Терапия» был пуст, а прикреплённый из каталога
// специалист приходил без id — записаться к нему было некуда.
//
// Тех, к кому уже есть запись, показываем всегда: карточка клиента у психолога
// и его раздел «Терапия» должны говорить об одном и том же. Открепление явное,
// и оно эту склейку переигрывает.
async function listFor(userId: number): Promise<TherapistLinkDTO[]> {
  const [links, booked] = await Promise.all([
    prisma.therapistLink.findMany({ where: { clientUserId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.appointment.findMany({
      where: { client: { userId }, status: { not: "cancelled" } },
      distinct: ["psychologistId"],
      orderBy: { startsAt: "asc" },
      select: { psychologistId: true },
    }),
  ]);

  const detached = new Set(links.filter((l) => l.detached).map((l) => l.psychologistId));
  const ids = [
    ...links.filter((l) => !l.detached).map((l) => l.psychologistId),
    ...booked.map((b) => b.psychologistId).filter((id) => !detached.has(id)),
  ];
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const profiles = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, firstName: true, psyProfile: { select: { name: true } } },
  });
  const nameOf = new Map(profiles.map((p) => [p.id, p.psyProfile?.name ?? p.firstName ?? "Специалист"]));
  const activeId = links.find((l) => l.active && !l.detached)?.psychologistId ?? unique[0];

  return unique.map((id) => ({ id, name: nameOf.get(id) ?? "Специалист", active: id === activeId }));
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json(await listFor(user.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

const patchSchema = z.object({
  psychologistId: z.coerce.number().int().positive(),
  /** attach — закрепить, detach — открепить, active — сделать текущим. */
  action: z.enum(["attach", "detach", "active"]),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await parseBody(req, patchSchema);
    if (body.psychologistId === user.id) {
      return NextResponse.json({ error: "Нельзя закрепить самого себя" }, { status: 422 });
    }

    const psy = await prisma.psyProfile.findUnique({ where: { userId: body.psychologistId }, select: { status: true } });
    if (!psy || psy.status !== "approved") {
      return NextResponse.json({ error: "Psychologist not found" }, { status: 404 });
    }

    const key = { clientUserId_psychologistId: { clientUserId: user.id, psychologistId: body.psychologistId } };
    if (body.action === "detach") {
      await prisma.therapistLink.upsert({
        where: key,
        create: { clientUserId: user.id, psychologistId: body.psychologistId, detached: true },
        update: { detached: true, active: false },
      });
    } else {
      // Текущий специалист один: снимаем метку с остальных до того, как ставим
      // её здесь, иначе раздел открывался на том, кого выбрали раньше.
      if (body.action === "active") {
        await prisma.therapistLink.updateMany({ where: { clientUserId: user.id }, data: { active: false } });
      }
      await prisma.therapistLink.upsert({
        where: key,
        create: { clientUserId: user.id, psychologistId: body.psychologistId, detached: false, active: body.action === "active" },
        update: { detached: false, ...(body.action === "active" ? { active: true } : {}) },
      });
    }

    return NextResponse.json(await listFor(user.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
