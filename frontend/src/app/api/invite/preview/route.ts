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
  let kind: "psy" | "card" | "group" = "psy";
  let group: { id: number; title: string; kind: "group" | "pair"; seats: number } | undefined;

  if (!psychologistId) {
    // Набор в группу: код подписан номером группы, ведущего берём из неё.
    const groupId = await readInviteCode("group", token);
    if (groupId) {
      const found = await prisma.group.findUnique({
        where: { id: groupId },
        select: { id: true, title: true, kind: true, capacity: true, psychologistId: true, status: true, _count: { select: { members: { where: { status: "active" } } } } },
      });
      if (found && found.status === "active") {
        psychologistId = found.psychologistId;
        kind = "group";
        group = {
          id: found.id,
          title: found.title,
          kind: found.kind === "pair" ? "pair" : "group",
          seats: Math.max(0, found.capacity - found._count.members),
        };
      }
    }
  }

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
    group,
    psy: {
      id: psychologistId,
      name: profile?.name?.trim() || user.firstName?.trim() || "Специалист",
      photo: photos[0] ?? user.photoUrl ?? "",
      method: profile?.primaryMethod ?? "",
      city: profile?.city ?? "",
    },
  });
}
