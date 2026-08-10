import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

type Diploma = { name: string; type: string; size: number; dataUrl: string };
type Verification = {
  fullName?: string; education?: string; publicLink?: string; about?: string;
  profilePercent?: number; photo?: string | null; diploma?: Diploma | null;
};

function row(p: {
  userId: number; name: string; primaryMethod: string; experienceYears: number;
  sessionPrice: number; city: string; format: string; status: string;
  rejectReason: string | null; submittedAt: Date | null; reviewedAt: Date | null;
  data: unknown;
  user: {
    username: string | null; firstName: string | null; email: string | null; createdAt: Date;
    psyDocuments: { id: number; kind: string; name: string; mime: string; size: number }[];
  };
}) {
  const v = ((p.data as { verification?: Verification } | null)?.verification ?? {}) as Verification;
  return {
    userId: p.userId,
    name: v.fullName || p.name,
    username: p.user.username,
    email: p.user.email,
    registeredAt: p.user.createdAt,
    status: p.status,
    rejectReason: p.rejectReason,
    submittedAt: p.submittedAt,
    reviewedAt: p.reviewedAt,
    method: p.primaryMethod,
    experienceYears: p.experienceYears,
    sessionPrice: p.sessionPrice,
    city: p.city,
    format: p.format,
    education: v.education ?? "",
    publicLink: v.publicLink ?? "",
    about: v.about ?? "",
    profilePercent: v.profilePercent ?? 0,
    photo: v.photo ?? null,
    // diploma — старые анкеты, где файл лежал data-URL'ом прямо в Json.
    // Новые кладут документы в PsyDocument; поле остаётся, пока такие анкеты
    // не разошлись по модерации.
    diploma: v.diploma ?? null,
    documents: p.user.psyDocuments,
  };
}

const select = {
  userId: true, name: true, primaryMethod: true, experienceYears: true,
  sessionPrice: true, city: true, format: true, status: true,
  rejectReason: true, submittedAt: true, reviewedAt: true, data: true,
  user: {
    select: {
      username: true, firstName: true, email: true, createdAt: true,
      // Сам файл не тащим — только метаданные и id, по которому модератор
      // откроет документ отдельным запросом.
      psyDocuments: { select: { id: true, kind: true, name: true, mime: true, size: true }, orderBy: { createdAt: "asc" } },
    },
  },
} as const;

/**
 * Очередь верификации психологов. Пока анкета не рассмотрена, человек не
 * попадает в каталог и не может брать клиентов, — поэтому очередь показываем
 * от самой старой заявки: ждать дольше всех хуже, чем ждать.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [queue, recent] = await Promise.all([
      prisma.psyProfile.findMany({
        where: { status: "review" },
        orderBy: { submittedAt: "asc" },
        select,
      }),
      prisma.psyProfile.findMany({
        where: { status: { in: ["approved", "rejected"] }, reviewedAt: { not: null } },
        orderBy: { reviewedAt: "desc" },
        take: 10,
        select,
      }),
    ]);

    return NextResponse.json({ queue: queue.map(row), recent: recent.map(row) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
