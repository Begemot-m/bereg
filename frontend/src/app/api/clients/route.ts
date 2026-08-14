import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { NOT_APPROVED, canAddClient, psyApproved } from "@/lib/server/access";
import { PHOTO_INCLUDE, withPhoto, withStats, withStatsOne } from "@/lib/server/clients";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const newClientSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(120),
  contact: z.string().trim().max(200).optional(),
  note: z.string().max(4000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    // Потолок на выдачу: у практикующего психолога карточек сотни, а список
    // грузится на каждом открытии раздела. Клиент может попросить больше.
    const url = new URL(req.url);
    const take = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
    const skip = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

    const clients = await prisma.client.findMany({
      where: { psychologistId: user.id },
      orderBy: { updatedAt: "desc" },
      // note — приватные заметки психолога, в списке они не нужны:
      // лишний трафик и лишняя копия чувствительного текста в браузере.
      omit: { note: true },
      include: PHOTO_INCLUDE,
      take,
      skip,
    });
    return NextResponse.json(await withStats(clients.map(withPhoto)));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await parseBody(req, newClientSchema);
    const name = body.name;

    if (!(await psyApproved(user.id))) {
      return NextResponse.json(NOT_APPROVED, { status: 403 });
    }

    // Лимит бесплатного тарифа проверяется здесь, а не только в интерфейсе:
    // иначе его обходит один запрос мимо приложения.
    const limit = await canAddClient(user.id);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "limit_reached", used: limit.used, limit: limit.limit, message: `На бесплатном тарифе доступно ${limit.limit} клиента. Подключите PRO, чтобы вести больше.` },
        { status: 402 },
      );
    }

    const client = await prisma.client.create({
      data: {
        psychologistId: user.id,
        name,
        contact: body.contact || null,
        note: body.note ?? "",
      },
    });
    return NextResponse.json(await withStatsOne(withPhoto(client)), { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
