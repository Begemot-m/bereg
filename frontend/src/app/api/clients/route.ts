import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const clients = await prisma.client.findMany({
      where: { psychologistId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(clients);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as { name?: string; contact?: string; note?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 422 });

    const client = await prisma.client.create({
      data: {
        psychologistId: user.id,
        name,
        contact: body.contact?.trim() || null,
        note: body.note ?? "",
      },
    });
    return NextResponse.json(client, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
