import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { LIMITS, limited } from "@/lib/server/rate-limit";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

const TOPICS = new Set(["bug", "billing", "data", "other"]);

/**
 * Обращение в поддержку. Работает и без входа — человек может не суметь
 * войти, и именно тогда поддержка нужнее всего; тогда просим контакт.
 */
export async function POST(req: NextRequest) {
  // Роут открыт без входа — значит он же и самая доступная мишень для спама.
  const stop = limited(req, "support", LIMITS.public);
  if (stop) return stop;

  const user = await requireUser(req).catch(() => null);
  const body = (await req.json().catch(() => ({}))) as { topic?: string; text?: string; contact?: string };

  const text = (body.text ?? "").trim().slice(0, 4000);
  if (!text) return NextResponse.json({ error: "text required" }, { status: 422 });
  const contact = (body.contact ?? "").trim().slice(0, 200) || null;
  if (!user && !contact) {
    return NextResponse.json({ error: "Нужен контакт для ответа" }, { status: 422 });
  }

  const created = await prisma.supportRequest.create({
    data: {
      userId: user?.id ?? null,
      topic: TOPICS.has(body.topic ?? "") ? body.topic! : "other",
      text,
      contact,
    },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
