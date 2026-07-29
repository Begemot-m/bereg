import { NextResponse, type NextRequest } from "next/server";

import { AuthError, requireUser } from "@/lib/server/session";
import { getTherapy, ownedClient } from "@/lib/server/therapy";

export const runtime = "nodejs";

// Психолог видит терапию только своего клиента: id из пути проверяется
// по владельцу карточки, иначе чужие данные утекают по перебору id.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const client = await ownedClient(Number(id), user.id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    return NextResponse.json(await getTherapy(client.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
