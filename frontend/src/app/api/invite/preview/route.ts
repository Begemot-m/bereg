import { NextResponse, type NextRequest } from "next/server";

import { readInviteCode } from "@/lib/server/invite-code";
import { verifyInviteToken } from "@/lib/server/jwt";
import { prisma } from "@/lib/server/prisma";
import { LIMITS, limited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

/**
 * Кто пригласил — для первого экрана по ссылке. Отдаём только то, что и так
 * видно в каталоге: имя, портрет, метод. Вход тут не нужен: экран показывается
 * человеку, который приложение ещё не открывал.
 *
 * Ссылка бывает двух видов: `card` — приглашение к заведённой карточке,
 * `psy` — общая ссылка специалиста, по которой карточка заводится сама.
 */
export async function GET(req: NextRequest) {
  const stop = limited(req, "invite-preview", LIMITS.public);
  if (stop) return stop;

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Приглашение недействительно" }, { status: 400 });

  let psychologistId: number | null = await readInviteCode("psy", token);
  let kind: "psy" | "card" = "psy";

  if (!psychologistId) {
    // Именная ссылка на карточку: короткий код, а для писем, отправленных до
    // перехода на ссылки в бота, — прежний подписанный токен.
    let clientId = await readInviteCode("card", token);
    if (!clientId) clientId = await verifyInviteToken(token).catch(() => null);
    if (clientId) {
      const card = await prisma.client.findUnique({ where: { id: clientId }, select: { psychologistId: true } });
      psychologistId = card?.psychologistId ?? null;
      kind = "card";
    }
  }

  if (!psychologistId) return NextResponse.json({ error: "Приглашение недействительно" }, { status: 400 });

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: psychologistId }, select: { firstName: true, photoUrl: true, deletedAt: true } }),
    prisma.psyProfile.findUnique({ where: { userId: psychologistId }, select: { name: true, primaryMethod: true, city: true, data: true } }),
  ]);
  if (!user || user.deletedAt) return NextResponse.json({ error: "Приглашение недействительно" }, { status: 400 });

  const data = (profile?.data as Record<string, unknown>) ?? {};
  const photos = Array.isArray(data.photos) ? (data.photos as string[]) : [];

  return NextResponse.json({
    kind,
    psy: {
      id: psychologistId,
      name: profile?.name?.trim() || user.firstName?.trim() || "Специалист",
      photo: photos[0] ?? user.photoUrl ?? "",
      method: profile?.primaryMethod ?? "",
      city: profile?.city ?? "",
    },
  });
}
