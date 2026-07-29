import { NextResponse, type NextRequest } from "next/server";

import { AuthError, requireUser } from "@/lib/server/session";
import { getTherapy, myClientCard, patchTherapy, type TherapyPatch } from "@/lib/server/therapy";

export const runtime = "nodejs";

// Пустая терапия для того, у кого ещё нет карточки: экран должен открыться
// и без психолога — статистика копится с первого дня.
const EMPTY = { moods: [], notes: [], board: "", wheel: null, tutorialSeen: false };

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

    const body = (await req.json()) as TherapyPatch;
    return NextResponse.json(await patchTherapy(card.id, body));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
