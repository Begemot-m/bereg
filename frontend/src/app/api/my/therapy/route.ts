import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { AuthError, requireUser } from "@/lib/server/session";
import { getTherapy, myClientCard, patchTherapy, type TherapyPatch } from "@/lib/server/therapy";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

// Границы здесь не декоративные: настроение 1–5 рисуется шкалой, колесо
// считает проценты от 0–10. Значение вне диапазона ломает не проверку,
// а график, который потом никто не поймёт.
const therapyPatchSchema = z.object({
  mood: z.coerce.number().min(1).max(5).optional(),
  emotions: z.array(z.string().max(40)).max(12).optional(),
  good: z.string().max(240).optional(),
  board: z.string().max(4000).optional(),
  wheel: z.record(z.string(), z.array(z.coerce.number().min(0).max(10))).optional(),
  tutorialSeen: z.boolean().optional(),
  reflection: z.object({
    appointmentId: z.coerce.number().int().positive(),
    preparation: z.string().max(2000).optional(),
    takeaway: z.string().max(2000).optional(),
    feeling: z.coerce.number().int().min(1).max(10).nullable().optional(),
  }).optional(),
  notesModule: z.object({ enabled: z.boolean().optional(), shared: z.boolean().optional() }).optional(),
});

// Пустая терапия для того, у кого ещё нет карточки: экран должен открыться
// и без психолога — статистика копится с первого дня.
const EMPTY = { moods: [], notes: [], board: "", wheel: null, tutorialSeen: false, reflections: [], notesModule: { enabled: false, shared: true, psychologistEnabled: false } };

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const card = await myClientCard(user.id);
    return NextResponse.json(card ? await getTherapy(card.id) : EMPTY);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const card = await myClientCard(user.id);
    if (!card) return NextResponse.json(EMPTY);

    const body = await parseBody(req, therapyPatchSchema);
    return NextResponse.json(await patchTherapy(card.id, body as TherapyPatch));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
