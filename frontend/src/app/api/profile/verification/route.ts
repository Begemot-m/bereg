import type { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Документ об образовании кладём в анкету как data-URL: файлового хранилища у
// платформы пока нет, а модератору нужен сам документ, а не имя файла. Пять
// мегабайт — тот же потолок, что на клиенте; с запасом на base64.
const MAX_DIPLOMA_CHARS = 7_500_000;
const DIPLOMA_TYPES = /^(image\/|application\/pdf$)/;

type Diploma = { name: string; type: string; size: number; dataUrl: string };

function readDiploma(raw: unknown): Diploma | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const dataUrl = String(d.dataUrl ?? "");
  const type = String(d.type ?? "");
  if (!dataUrl.startsWith("data:") || dataUrl.length > MAX_DIPLOMA_CHARS) return null;
  if (!DIPLOMA_TYPES.test(type)) return null;
  return {
    name: String(d.name ?? "документ").slice(0, 120),
    type,
    size: Number(d.size ?? 0) || 0,
    dataUrl,
  };
}

// Заявка на подтверждение практики. Статус ставит только этот роут и модерация:
// сам психолог перевести себя в approved не может.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as Record<string, unknown>;

    // Заявка из каталога присылает имя полем `name`: раньше роут знал только
    // `fullName` и отвечал 422 на каждую такую отправку.
    const fullName = String(body.fullName ?? body.name ?? "").trim();
    const education = String(body.education ?? "").trim();
    if (fullName.length < 3 || education.length < 5) {
      return NextResponse.json({ error: "fullName and education required" }, { status: 422 });
    }

    const current = await prisma.psyProfile.findUnique({ where: { userId: user.id } });
    if (current?.status === "approved") {
      return NextResponse.json({ error: "already approved" }, { status: 409 });
    }

    const verification = {
      fullName,
      education,
      publicLink: String(body.publicLink ?? "").trim(),
      about: String(body.about ?? "").trim(),
      profilePercent: Number(body.profilePercent ?? 0) || 0,
      diploma: readDiploma(body.diploma),
    };
    const data = { ...((current?.data as object) ?? {}), verification } as Prisma.InputJsonValue;

    const fields = {
      status: "review",
      rejectReason: null,
      submittedAt: new Date(),
      reviewedAt: null,
      data,
    };

    await prisma.psyProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: fullName,
        primaryMethod: String(body.method ?? ""),
        experienceYears: Number(body.experienceYears ?? 0) || 0,
        ...fields,
      },
      update: fields,
    });

    // Один аккаунт, две роли: подача заявки открывает переключатель кабинетов,
    // приём клиентов остаётся закрытым до approved.
    if (user.role !== "psychologist") {
      await prisma.user.update({ where: { id: user.id }, data: { role: "psychologist" } });
    }

    await audit(req, { userId: user.id, action: "psy.verification.submit" });
    return NextResponse.json({ status: "review" });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
