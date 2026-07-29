import type { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Анкета отдаётся одним объектом — тем же, с которым работает форма профиля.
// Колонки, по которым фильтрует каталог, разложены отдельно, но наружу
// склеиваются обратно: клиент про это устройство знать не должен.
type Row = {
  name: string; primaryMethod: string; experienceYears: number; sessionPrice: number;
  sessionMinutes: number; format: string; city: string; status: string; data: unknown;
};

const toDTO = (row: Row) => ({
  ...(row.data as Record<string, unknown>),
  name: row.name,
  primaryMethod: row.primaryMethod,
  experienceYears: String(row.experienceYears),
  sessionPrice: row.sessionPrice,
  sessionMinutes: row.sessionMinutes,
  format: row.format,
  status: row.status,
});

const FILTERABLE = new Set([
  "name", "primaryMethod", "experienceYears", "sessionPrice",
  "sessionMinutes", "format", "status", "location",
]);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const row = await prisma.psyProfile.findUnique({ where: { userId: user.id } });
    return NextResponse.json(row ? toDTO(row) : null);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as Record<string, unknown>;

    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 422 });

    // Всё, что не участвует в фильтрах каталога, едет в JSON как есть.
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) if (!FILTERABLE.has(k)) rest[k] = v;
    rest.location = body.location ?? {};
    const data = rest as Prisma.InputJsonValue;

    const location = (body.location ?? {}) as { city?: string };
    const fields = {
      name,
      primaryMethod: String(body.primaryMethod ?? ""),
      experienceYears: Number(body.experienceYears ?? 0) || 0,
      sessionPrice: Number(body.sessionPrice ?? 0) || 0,
      sessionMinutes: Number(body.sessionMinutes ?? 50) || 50,
      format: String(body.format ?? "online"),
      city: String(location.city ?? ""),
      // Статус ставит модерация, не сам психолог: иначе публикация в каталоге
      // была бы вопросом одного запроса из консоли браузера.
      data,
    };

    const row = await prisma.psyProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...fields, status: "review" },
      update: fields,
    });
    return NextResponse.json(toDTO(row));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
