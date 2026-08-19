import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { NOT_APPROVED, access, acceptingNewClients, notifyLimitReached, psyApproved } from "@/lib/server/access";
import { NEEDS_PRO_MODULE, announce, moduleClosed } from "@/lib/server/groups";
import { readInviteCode } from "@/lib/server/invite-code";
import { prisma } from "@/lib/server/prisma";
import { LIMITS, limited } from "@/lib/server/rate-limit";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

/**
 * Приход по ссылке набора: человек занимает место в группе сам. Одним переходом
 * делается всё, что иначе ведущий делал руками, — заводится карточка клиента,
 * специалист становится терапевтом, участник встаёт в состав. Отдельной заявки
 * на вход нет намеренно: ссылку ведущий даёт тем, кого уже позвал.
 */
export async function POST(req: NextRequest) {
  try {
    // Ссылка общая и лежит в переписке — дверь держим за лимитом, как и приём
    // общей ссылки специалиста.
    const stop = limited(req, "group-join", LIMITS.auth);
    if (stop) return stop;

    const user = await requireUser(req);
    const closed = moduleClosed();
    if (closed) return closed;

    const body = await parseBody(req, z.object({ token: z.string().min(1).max(2000) }));
    const groupId = await readInviteCode("group", body.token);
    if (!groupId) return NextResponse.json({ error: "Приглашение недействительно" }, { status: 400 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.status !== "active") return NextResponse.json({ error: "Приглашение недействительно" }, { status: 400 });

    const psychologistId = group.psychologistId;
    // Ведущий открыл собственную ссылку — обычно проверяя, как она выглядит.
    if (psychologistId === user.id) {
      return NextResponse.json({ error: "self", message: "Это ваша собственная ссылка" }, { status: 400 });
    }
    if (!(await psyApproved(psychologistId))) return NextResponse.json(NOT_APPROVED, { status: 403 });
    // Модуль платный: без подписки ведущего ссылка не работает — иначе состав
    // рос бы у того, кому группы уже недоступны.
    const acc = await access(psychologistId);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const existing = await prisma.client.findFirst({ where: { psychologistId, userId: user.id } });
    if (!existing) {
      const seats = await acceptingNewClients(psychologistId);
      if (!seats.accepting) {
        await notifyLimitReached(psychologistId);
        return NextResponse.json({ error: "not_accepting", message: "Специалист временно не принимает новых клиентов" }, { status: 402 });
      }
    }

    const card = existing
      ? await prisma.client.update({ where: { id: existing.id }, data: { link: "joined" } })
      : await prisma.client.create({
          data: { psychologistId, userId: user.id, name: user.firstName?.trim() || "Новый клиент", link: "joined" },
        });

    const links = await prisma.therapistLink.findMany({ where: { clientUserId: user.id, detached: false } });
    await prisma.therapistLink.upsert({
      where: { clientUserId_psychologistId: { clientUserId: user.id, psychologistId } },
      create: { clientUserId: user.id, psychologistId, detached: false, active: links.length === 0 },
      update: { detached: false },
    });

    const already = await prisma.groupMember.findFirst({ where: { groupId: group.id, clientId: card.id, status: "active" } });
    if (already) return NextResponse.json({ ok: true, groupId: group.id, clientId: card.id, joined: false });

    // Мест считаем по активным участникам — ушедшие место не занимают.
    const used = await prisma.groupMember.count({ where: { groupId: group.id, status: "active" } });
    if (used >= group.capacity) {
      return NextResponse.json({ error: "no_seats", message: "В группе не осталось мест" }, { status: 409 });
    }

    await prisma.groupMember.create({ data: { groupId: group.id, clientId: card.id, name: card.name } });
    await announce(group.id, "event", `В группе новый участник: ${card.name}`);
    await prisma.notification.create({
      data: {
        userId: psychologistId,
        kind: "system",
        text: `«${card.name}» пришёл по ссылке в группу «${group.title}»`,
      },
    });

    return NextResponse.json({ ok: true, groupId: group.id, clientId: card.id, joined: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
