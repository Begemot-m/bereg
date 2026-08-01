import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { AuthError, requireUser } from "@/lib/server/session";
import { getTherapy, ownedClient, setPsychologistNotesModule } from "@/lib/server/therapy";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

// Психолог видит терапию только своего клиента: id из пути проверяется
// по владельцу карточки, иначе чужие данные утекают по перебору id.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await ownedClient(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const therapy = await getTherapy(client.id);
    return NextResponse.json(therapy.notesModule.psychologistEnabled && therapy.notesModule.shared ? therapy : { ...therapy, reflections: [] });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await ownedClient(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    const body = await parseBody(req, z.object({ notesModuleEnabled: z.boolean() }));
    const therapy = await setPsychologistNotesModule(client.id, body.notesModuleEnabled);
    return NextResponse.json(therapy.notesModule.psychologistEnabled && therapy.notesModule.shared ? therapy : { ...therapy, reflections: [] });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
