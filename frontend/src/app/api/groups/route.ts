import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { access } from "@/lib/server/access";
import { MEMBERS_INCLUDE, NEEDS_PRO_MODULE, moduleClosed } from "@/lib/server/groups";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";

export const runtime = "nodejs";

const newGroupSchema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(120),
  kind: z.enum(["group", "pair"]).default("group"),
  capacity: z.number().int().min(2).max(40).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const closed = moduleClosed();
    if (closed) return closed;
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const groups = await prisma.group.findMany({
      where: { psychologistId: user.id, status: "active" },
      orderBy: { createdAt: "desc" },
      include: MEMBERS_INCLUDE,
    });
    return NextResponse.json(groups);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const closed = moduleClosed();
    if (closed) return closed;
    const acc = await access(user.id);
    if (!acc.pro) return NextResponse.json(NEEDS_PRO_MODULE, { status: 402 });

    const body = await parseBody(req, newGroupSchema);
    // У пары мест ровно два — третий участник в паре означает ошибку ввода,
    // а не большую пару.
    const capacity = body.kind === "pair" ? 2 : (body.capacity ?? 8);
    const group = await prisma.group.create({
      data: { psychologistId: user.id, title: body.title, kind: body.kind, capacity },
      include: MEMBERS_INCLUDE,
    });
    return NextResponse.json(group, { status: 201 });
  } catch (e) {
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
