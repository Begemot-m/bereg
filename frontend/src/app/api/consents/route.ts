import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { AuthError, requireUser } from "@/lib/server/session";

export const runtime = "nodejs";

// Виды согласий. health — отдельное: данные о состоянии между сессиями
// трактуются как специальная категория, и общего согласия для них мало.
const KINDS = new Set(["pd", "health", "offer", "marketing"]);
const POLICY_VERSION = process.env.POLICY_VERSION ?? "dev";

/**
 * Что человек уже подписал и на какой версии документа. Клиент по этому
 * ответу решает, показывать ли экран согласия: если версия политики выросла,
 * согласие нужно собрать заново.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const rows = await prisma.consent.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { grantedAt: "desc" },
    });

    const granted: Record<string, { policyVersion: string; grantedAt: string; current: boolean }> = {};
    for (const row of rows) {
      if (granted[row.kind]) continue; // берём только самое свежее по виду
      granted[row.kind] = {
        policyVersion: row.policyVersion,
        grantedAt: row.grantedAt.toISOString(),
        current: row.policyVersion === POLICY_VERSION,
      };
    }
    return NextResponse.json({ policyVersion: POLICY_VERSION, granted });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

/**
 * Дать согласие. Пишем именно то, что потом придётся доказывать: вид, версию
 * документа, время, адрес и устройство. Версию берём с сервера, а не из тела
 * запроса — иначе клиент мог бы «согласиться» на любую редакцию.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as { kinds?: string[] };
    const kinds = (body.kinds ?? []).filter((k) => KINDS.has(k));
    if (kinds.length === 0) return NextResponse.json({ error: "kinds required" }, { status: 422 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent");

    await prisma.$transaction([
      ...kinds.map((kind) =>
        prisma.consent.create({
          data: { userId: user.id, kind, policyVersion: POLICY_VERSION, ip, userAgent },
        }),
      ),
      prisma.auditLog.create({
        data: { userId: user.id, action: "consent.grant", entity: "Consent", ip, userAgent, meta: { kinds, policyVersion: POLICY_VERSION } },
      }),
    ]);

    return NextResponse.json({ ok: true, policyVersion: POLICY_VERSION });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

/**
 * Отозвать согласие. Не удаляем запись — она доказательство того, что согласие
 * было дано и когда именно отозвано. Ставим revokedAt.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const kind = new URL(req.url).searchParams.get("kind");
    if (!kind || !KINDS.has(kind)) return NextResponse.json({ error: "kind required" }, { status: 422 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await prisma.$transaction([
      prisma.consent.updateMany({
        where: { userId: user.id, kind, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: { userId: user.id, action: "consent.revoke", entity: "Consent", ip, meta: { kind } },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
