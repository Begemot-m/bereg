import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { decryptField, encryptField, encryptionReady } from "@/lib/server/crypto";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const enc = (v: string) => (encryptionReady() ? encryptField(v) : v);
const dec = (v: string) => (encryptionReady() ? decryptField(v) : v);

export type ReviewDTO = { rating: number; text: string; authorName: string; createdAt: string; mine: boolean };

// viewerId — чья оценка своя. Человек должен её узнать, чтобы поправить, а не
// поставить вторую; у гостя это просто общий список.
async function summaryFor(psychologistId: number, viewerId: number) {
  const rows = await prisma.review.findMany({
    where: { psychologistId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { author: { select: { id: true, firstName: true } } },
  });

  const list: ReviewDTO[] = rows.map((row) => ({
    rating: row.rating,
    text: dec(row.text),
    authorName: row.author.firstName ?? "Клиент",
    createdAt: row.createdAt.toISOString(),
    mine: row.author.id === viewerId,
  }));

  const count = rows.length;
  const rating = count ? Math.round((rows.reduce((sum, row) => sum + row.rating, 0) / count) * 10) / 10 : 0;
  return { rating, count, list };
}

// Оценки специалиста. Открыты без входа: рейтинг — часть карточки в каталоге,
// а каталог смотрят до регистрации.
export async function GET(req: NextRequest) {
  const psychologistId = Number(new URL(req.url).searchParams.get("psy"));
  if (!Number.isInteger(psychologistId) || psychologistId <= 0) {
    return NextResponse.json({ error: "psy required" }, { status: 422 });
  }
  const viewerId = await requireUser(req).then((u) => u.id).catch(() => 0);
  return NextResponse.json(await summaryFor(psychologistId, viewerId));
}

const reviewSchema = z.object({
  psychologistId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().max(2000).optional(),
});

// Оценку ставит только тот, у кого со специалистом была встреча: иначе рейтинг
// накручивается с любого свежего аккаунта.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await parseBody(req, reviewSchema);
    if (body.psychologistId === user.id) {
      return NextResponse.json({ error: "Нельзя оценить самого себя" }, { status: 422 });
    }

    const attended = await prisma.appointment.findFirst({
      where: {
        psychologistId: body.psychologistId,
        client: { userId: user.id },
        status: "done",
      },
      select: { id: true },
    });
    if (!attended) {
      return NextResponse.json({ error: "Оценить можно после состоявшейся встречи" }, { status: 403 });
    }

    const text = enc((body.text ?? "").trim().slice(0, 2000));
    await prisma.review.upsert({
      where: { authorId_psychologistId: { authorId: user.id, psychologistId: body.psychologistId } },
      create: { authorId: user.id, psychologistId: body.psychologistId, rating: body.rating, text },
      update: { rating: body.rating, text },
    });

    return NextResponse.json(await summaryFor(body.psychologistId, user.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
