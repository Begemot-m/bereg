import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { canWorkWithPsy } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { psyCardsByIds, type PsyCard } from "@/lib/server/psy-card";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

// Карточка целиком, а не id с именем: раздел «Терапия» рисует специалиста теми
// же полями, что и каталог. Пока роут отдавал только имя, закреплённый терапевт
// показывался буквой вместо фото — остальное страница искала в статическом
// списке демо-анкет, которого в бою нет.
export type TherapistLinkDTO = PsyCard & { active: boolean };

// Закреплённые специалисты клиента. Раньше список жил в localStorage: на
// втором устройстве раздел «Терапия» был пуст, а прикреплённый из каталога
// специалист приходил без id — записаться к нему было некуда.
//
// Тех, к кому уже есть запись, показываем всегда: карточка клиента у психолога
// и его раздел «Терапия» должны говорить об одном и том же. Открепление явное,
// и оно эту склейку переигрывает.
async function listFor(userId: number): Promise<TherapistLinkDTO[]> {
  const [links, booked, clientCards] = await Promise.all([
    prisma.therapistLink.findMany({ where: { clientUserId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.appointment.findMany({
      where: { client: { userId }, status: { not: "cancelled" } },
      distinct: ["psychologistId"],
      orderBy: { startsAt: "asc" },
      select: { psychologistId: true },
    }),
    // Психолог, у которого человек заведён клиентом, — его терапевт, даже если
    // записей ещё не было. Иначе принятое приглашение никак не отражалось в
    // разделе «Терапия» до первой встречи.
    prisma.client.findMany({
      where: { userId, psychologistId: { not: null } },
      distinct: ["psychologistId"],
      orderBy: { createdAt: "asc" },
      select: { psychologistId: true },
    }),
  ]);

  const detached = new Set(links.filter((l) => l.detached).map((l) => l.psychologistId));
  const ids = [
    ...links.filter((l) => !l.detached).map((l) => l.psychologistId),
    ...clientCards.map((c) => c.psychologistId as number).filter((id) => !detached.has(id)),
    ...booked.map((b) => b.psychologistId).filter((id) => !detached.has(id)),
  ];
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const [cards, users] = await Promise.all([
    psyCardsByIds(unique),
    prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true } }),
  ]);
  const cardOf = new Map(cards.map((card) => [card.id, card]));
  const nameOf = new Map(users.map((u) => [u.id, u.firstName ?? "Специалист"]));
  const activeId = links.find((l) => l.active && !l.detached)?.psychologistId ?? unique[0];

  // Анкеты может не быть вовсе (психолог завёл клиента до её заполнения) —
  // тогда карточка минимальная, но список не рвётся.
  return unique.map((id) => {
    const card = cardOf.get(id);
    return card
      ? { ...card, active: id === activeId }
      : ({ id, name: nameOf.get(id) ?? "Специалист", active: id === activeId } as TherapistLinkDTO);
  });
}

/**
 * Клиент закрепил специалиста — значит специалист видит его в «Клиентах».
 * Раньше связь была односторонней: у клиента терапевт появлялся, а психолог
 * узнавал о нём только с первой записи.
 *
 * Личную карточку без психолога не трогаем и новую заводим лишь тогда, когда
 * карточки у этой пары ещё нет: настроение и колесо привязаны к ней, и
 * переносить их между психологами нельзя.
 */
async function ensureClientCard(clientUserId: number, psychologistId: number) {
  const existing = await prisma.client.findFirst({ where: { psychologistId, userId: clientUserId }, select: { id: true } });
  if (existing) return;

  const me = await prisma.user.findUnique({ where: { id: clientUserId }, select: { firstName: true, username: true } });
  const name = me?.firstName?.trim() || (me?.username ? `@${me.username}` : "Клиент");
  await prisma.client.create({
    data: {
      psychologistId,
      userId: clientUserId,
      name,
      contact: me?.username ? `@${me.username}` : null,
      link: "joined",
      status: "new",
    },
  });
  await prisma.notification.create({
    data: {
      userId: psychologistId,
      kind: "system",
      text: `«${name}» — новый клиент из раздела «Терапия»: карточка появилась в списке`,
    },
  });
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

    // Открепиться можно от кого угодно: связь уже есть, и держать её из-за
    // статуса анкеты бессмысленно.
    if (body.action !== "detach" && !(await canWorkWithPsy(user.id, body.psychologistId))) {
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
      await ensureClientCard(user.id, body.psychologistId);
    }

    return NextResponse.json(await listFor(user.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
