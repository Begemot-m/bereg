import type { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { mergeProfilePatch, PROFILE_COLUMNS } from "@/lib/server/profile-patch";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Анкета отдаётся одним объектом — тем же, с которым работает форма профиля.
// Колонки, по которым фильтрует каталог, разложены отдельно, но наружу
// склеиваются обратно: клиент про это устройство знать не должен.
type Row = {
  name: string; primaryMethod: string; experienceYears: number; sessionPrice: number;
  sessionMinutes: number; format: string; city: string; status: string; data: unknown;
  rejectReason?: string | null; submittedAt?: Date | null; updatedAt?: Date | null;
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
  rejectReason: row.rejectReason ?? null,
  submittedAt: row.submittedAt ?? null,
  updatedAt: row.updatedAt ?? null,
});

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
    for (const [k, v] of Object.entries(body)) if (!PROFILE_COLUMNS.has(k)) rest[k] = v;
    rest.location = body.location ?? {};
    const data = rest as Prisma.InputJsonValue;

    const location = (body.location ?? {}) as { city?: string };
    const fields = {
      name,
      primaryMethod: String(body.primaryMethod ?? ""),
      experienceYears: Number(body.experienceYears ?? 0) || 0,
      sessionPrice: Number(body.sessionPrice ?? 0) || 0,
      // Ноль и пустая строка — законное «ещё не заполнено»: анкета начинается
      // пустой, и подставлять за специалиста цену, длительность или формат
      // нельзя — иначе он выложит в каталог не свои условия.
      sessionMinutes: Number(body.sessionMinutes ?? 0) || 0,
      format: String(body.format ?? ""),
      city: String(location.city ?? ""),
      // Статус ставит модерация, не сам психолог: иначе публикация в каталоге
      // была бы вопросом одного запроса из консоли браузера.
      data,
    };

    const row = await prisma.psyProfile.upsert({
      where: { userId: user.id },
      // Сохранить анкету — не то же самое, что подать заявку: на модерацию
      // отправляет только /profile/verification.
      create: { userId: user.id, ...fields, status: "draft" },
      update: fields,
    });
    return NextResponse.json(toDTO(row));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

// Правка анкеты приходит полями, а не целиком: два устройства, открытые на
// разных шагах, больше не затирают друг друга — доезжает только то, что человек
// действительно поменял.
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as Record<string, unknown>;
    const cur = await prisma.psyProfile.findUnique({ where: { userId: user.id } });
    const { data, fields } = mergeProfilePatch((cur?.data as Record<string, unknown> | null) ?? {}, body);
    const json = data as Prisma.InputJsonValue;

    // Статус трогает только модерация — как и в PUT.
    const row = cur
      ? await prisma.psyProfile.update({ where: { userId: user.id }, data: { ...fields, data: json } })
      : await prisma.psyProfile.create({
          data: {
            userId: user.id,
            name: fields.name ?? "",
            primaryMethod: fields.primaryMethod ?? "",
            experienceYears: fields.experienceYears ?? 0,
            sessionPrice: fields.sessionPrice ?? 0,
            sessionMinutes: fields.sessionMinutes ?? 0,
            format: fields.format ?? "",
            city: fields.city ?? "",
            status: "draft",
            data: json,
          },
        });
    return NextResponse.json(toDTO(row));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
