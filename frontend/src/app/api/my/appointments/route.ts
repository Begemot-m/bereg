import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { acceptingNewClients, canWorkWithPsy, notifyLimitReached } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";
import { checkSlotOpen } from "@/lib/server/schedule";
import { AuthError, requireUser } from "@/lib/server/session";
import { InvalidBody, invalidBodyResponse, parseBody } from "@/lib/server/validate";
import { queueTelegramEvent, replaceReminders } from "@/lib/server/telegram-delivery";
import { APP_ZONE } from "@/lib/server/zone";

export const runtime = "nodejs";

const bookSchema = z.object({
  psychologistId: z.coerce.number().int().positive(),
  startsAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
  durationMin: z.coerce.number().int().min(15).max(240).optional(),
  format: z.enum(["online", "offline"]).optional(),
});

const plDays = (n: number) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? "день" : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? "дня" : "дней";
};

type ApptRow = {
  id: number;
  psychologistId: number;
  startsAt: Date;
  durationMin: number;
  format: string;
  confirmedAt: Date | null;
  psychologist: { psyProfile: { name: string } | null; firstName: string | null; workHours: { cancelLockDays: number } | null };
};

// cancelLockDays едет вместе с записью: правило задаёт психолог, а применяет
// его экран клиента на другом устройстве — из localStorage оно туда не попадёт.
const toDTO = (a: ApptRow) => ({
  id: a.id,
  psychologistId: a.psychologistId,
  psyName: a.psychologist.psyProfile?.name ?? a.psychologist.firstName ?? "Специалист",
  startsAt: a.startsAt.toISOString(),
  durationMin: a.durationMin,
  format: a.format,
  confirmed: a.confirmedAt !== null,
  cancelLockDays: a.psychologist.workHours?.cancelLockDays ?? 0,
});

const include = {
  psychologist: {
    select: { firstName: true, psyProfile: { select: { name: true } }, workHours: { select: { cancelLockDays: true } } },
  },
};

// Записи клиента к специалистам. Это те же Appointment, что видит психолог, —
// просто смотрим с другой стороны: через карточки, привязанные к аккаунту.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const list = await prisma.appointment.findMany({
      where: { client: { userId: user.id }, status: { not: "cancelled" } },
      orderBy: { startsAt: "asc" },
      include,
    });
    return NextResponse.json(list.map(toDTO));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await parseBody(req, bookSchema);

    const psychologistId = body.psychologistId;
    const startsAt = new Date(body.startsAt);
    // Запись в прошлое — не ошибка формата, а ошибка смысла: ловим отдельно.
    if (startsAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Нельзя записаться в прошлое" }, { status: 422 });
    }

    // Неодобренная анкета закрыта для всех, кроме тех, кого этот психолог
    // позвал сам: анкету по приглашению человек уже видит, и упираться в
    // «специалист не найден» на кнопке записи ему незачем.
    const psy = await prisma.psyProfile.findUnique({ where: { userId: psychologistId } });
    if (!psy || !(await canWorkWithPsy(user.id, psychologistId))) {
      return NextResponse.json({ error: "Psychologist not found" }, { status: 404 });
    }

    // Записаться можно к любому одобренному специалисту, даже если бесплатные
    // места у него кончились: тариф психолога клиента не касается, а закрытая
    // запись не даёт специалисту увидеть, что каталог вообще приводит людей.
    // Деньги стоят дальше — на подтверждении встречи (`confirmGate`). Пока
    // человек не подтверждён, его карточка помечена `pending` и места не
    // занимает.
    const seats = await acceptingNewClients(psychologistId);
    if (!seats.accepting) await notifyLimitReached(psychologistId);

    // Окно должно быть по-настоящему открыто: правила приёма — дело психолога,
    // и проверять их можно только здесь. Экран клиенту не указ: закрытую дату,
    // чужое время и окно ближе запрета на запись он может прислать сам.
    const open = await checkSlotOpen(psychologistId, startsAt);
    if (!open.ok) {
      if (open.reason === "taken") return NextResponse.json({ error: "Слот уже занят" }, { status: 409 });
      if (open.reason === "lead") {
        return NextResponse.json(
          { error: `${open.fmt === "offline" ? "Очная запись" : "Онлайн-запись"} — не позже чем за ${open.leadDays} ${plDays(open.leadDays)}` },
          { status: 422 },
        );
      }
      return NextResponse.json({ error: "Это время закрыто для записи. Выберите другое окно" }, { status: 409 });
    }
    const format = open.fmt;

    // Карточка клиента у этого психолога: если её нет — заводим.
    // Так запись сразу появляется у специалиста в разделе «Клиенты».
    const card =
      (await prisma.client.findFirst({ where: { psychologistId, userId: user.id } })) ??
      (await prisma.client.create({
        data: {
          psychologistId,
          userId: user.id,
          name: user.firstName ?? "Клиент",
          link: "joined",
          status: "new",
          // Новый человек из каталога занимает место только после того, как
          // специалист подтвердит встречу.
          pending: !seats.accepting,
        },
      }));

    try {
      const appt = await prisma.$transaction(async (tx) => {
        const created = await tx.appointment.create({
          data: {
            psychologistId,
            clientId: card.id,
            startsAt,
            durationMin: Number(body.durationMin) || psy.sessionMinutes,
            format,
          },
          include,
        });

        await tx.notification.create({
          data: {
            userId: psychologistId,
            kind: "booking",
            text: `К вам записались · ${card.name} · ${startsAt.toLocaleString("ru-RU", { timeZone: APP_ZONE, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}. Подтвердите встречу в приложении.`,
          },
        });
        await queueTelegramEvent(tx, { appointmentId: created.id, recipientId: psychologistId, audience: "psychologist", kind: "booking" });
        await queueTelegramEvent(tx, { appointmentId: created.id, recipientId: user.id, audience: "client", kind: "booking" });
        await replaceReminders(tx, {
          appointmentId: created.id,
          clientUserId: user.id,
          psychologistUserId: psychologistId,
          startsAt,
          reminder2h: user.sessionReminder2h,
        });
        return created;
      });

      return NextResponse.json(toDTO(appt), { status: 201 });
    } catch (e) {
      // Гонку ловит уникальный индекс: пока мы проверяли занятость, окно
      // мог занять другой человек.
      if (typeof e === "object" && e && (e as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "Окно только что заняли" }, { status: 409 });
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof InvalidBody) return invalidBodyResponse(e);
    throw e;
  }
}
