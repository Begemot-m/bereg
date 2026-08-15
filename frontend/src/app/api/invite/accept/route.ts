import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { acceptingNewClients, NOT_APPROVED, notifyLimitReached, psyApproved } from "@/lib/server/access";
import { readInviteCode } from "@/lib/server/invite-code";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

/**
 * Приглашение по общей ссылке специалиста. Карточки заранее нет — она заводится
 * этим переходом и сразу подключённой: человек уже вошёл под своим аккаунтом,
 * просить его «подключить профиль» вторым шагом незачем.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await parseBody(req, z.object({ token: z.string().min(1).max(2000) }));

    const psychologistId = await readInviteCode("psy", body.token);
    if (!psychologistId) return NextResponse.json({ error: "Приглашение недействительно" }, { status: 400 });
    // Специалист открыл собственную ссылку — обычно чтобы проверить, как она
    // выглядит. Ни карточки, ни связи: приложение по этому коду вернёт его в
    // роль специалиста и объяснит, что ссылка для клиента.
    if (psychologistId === user.id) {
      return NextResponse.json({ error: "self", message: "Это ваша собственная ссылка" }, { status: 400 });
    }

    if (!(await psyApproved(psychologistId))) return NextResponse.json(NOT_APPROVED, { status: 403 });

    const existing = await prisma.client.findFirst({ where: { psychologistId, userId: user.id } });

    // Лимит бесплатных мест проверяем только для новой карточки: у своего
    // клиента, который уже есть в списке, ссылка не должна отваливаться.
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
          data: {
            psychologistId,
            userId: user.id,
            name: user.firstName?.trim() || "Новый клиент",
            link: "joined",
          },
        });

    // Пригласивший специалист сразу становится терапевтом — ровно то же, что
    // делает приём именной ссылки в /clients/join.
    const links = await prisma.therapistLink.findMany({ where: { clientUserId: user.id, detached: false } });
    await prisma.therapistLink.upsert({
      where: { clientUserId_psychologistId: { clientUserId: user.id, psychologistId } },
      create: { clientUserId: user.id, psychologistId, detached: false, active: links.length === 0 },
      update: { detached: false },
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          userId: psychologistId,
          kind: "system",
          text: `«${card.name}» пришёл по вашей ссылке — карточка создана`,
        },
      });
    }

    return NextResponse.json({ ok: true, clientId: card.id });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
