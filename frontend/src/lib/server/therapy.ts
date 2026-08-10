// Терапия на сервере: настроение, записи «что хорошего», доска и колесо.
// Всё, что человек пишет о себе, — специальная категория ПД, поэтому тексты
// проходят через шифрование, а наружу отдаются в том же виде, что и в демо.

import { decryptField, encryptField, encryptionReady } from "@/lib/server/crypto";
import { prisma } from "@/lib/server/prisma";

export type MoodDTO = { date: string; mood: number; emotions?: string[] };
export type NoteDTO = { date: string; text: string };
export type WheelDTO = { answers: Record<string, number[]>; completedAt: string } | null;
export type SessionReflectionDTO = {
  appointmentId: number;
  startsAt: string;
  status: string;
  therapistName: string;
  preparation: string;
  takeaway: string;
  feeling: number | null;
  updatedAt: string;
};
export type TherapyDTO = {
  moods: MoodDTO[];
  notes: NoteDTO[];
  board: string;
  wheel: WheelDTO;
  tutorialSeen: boolean;
  reflections: SessionReflectionDTO[];
  notesModule: { enabled: boolean; shared: boolean; psychologistEnabled: boolean };
};

// Тексты шифруем, только если ключ задан: в деве без DATA_KEY приложение
// продолжает работать, просто без шифрования.
const enc = (v: string) => (encryptionReady() ? encryptField(v) : v);
const dec = (v: string) => (encryptionReady() ? decryptField(v) : v);

/** Полдень выбранного дня: ключ дня без сюрпризов с часовыми поясами. */
export function dayKey(d = new Date()): Date {
  const day = new Date(d);
  day.setHours(12, 0, 0, 0);
  return day;
}

/**
 * Где лежат настроение, колесо и «что хорошего» этого человека. Это данные
 * человека, а не карточки у конкретного психолога: со вторым специалистом
 * заводится вторая карточка, и половина истории оставалась в первой — клиент
 * видел одно, психолог в карточке другое. Владелец — самая ранняя карточка
 * аккаунта. У карточки без привязанного аккаунта своя история: её ведёт
 * психолог, переносить некуда.
 */
export async function therapyOwnerId(client: { id: number; userId: number | null }): Promise<number> {
  if (!client.userId) return client.id;
  const first = await prisma.client.findFirst({
    where: { userId: client.userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? client.id;
}

/**
 * allCards — смотрит сам клиент, и подготовки к встречам нужны по всем его
 * психологам. Психолог видит только те, что относятся к его карточке.
 */
export async function getTherapy(clientId: number, opts: { allCards?: boolean } = {}): Promise<TherapyDTO> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, userId: true, notesModuleEnabled: true, notesModuleShared: true, notesModulePsychologist: true },
  });
  const ownerId = client ? await therapyOwnerId(client) : clientId;
  const reflectionScope = opts.allCards && client?.userId
    ? { client: { userId: client.userId } }
    : { clientId };

  const [moods, notes, profile, reflections] = await Promise.all([
    prisma.mood.findMany({ where: { clientId: ownerId }, orderBy: { day: "asc" }, take: 30 }),
    prisma.goodNote.findMany({ where: { clientId: ownerId }, orderBy: { day: "asc" }, take: 60 }),
    prisma.therapyProfile.findUnique({ where: { clientId: ownerId } }),
    prisma.sessionReflection.findMany({
      where: reflectionScope,
      orderBy: { appointment: { startsAt: "desc" } },
      take: 30,
      include: {
        appointment: {
          select: {
            startsAt: true,
            status: true,
            psychologist: { select: { firstName: true, psyProfile: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  return {
    moods: moods.map((m) => ({
      date: m.day.toISOString(),
      mood: m.mood,
      emotions: (m.emotions as string[]) ?? [],
    })),
    notes: notes.map((n) => ({ date: n.day.toISOString(), text: dec(n.text) })),
    board: profile ? dec(profile.board) : "",
    wheel: (profile?.wheel as WheelDTO) ?? null,
    tutorialSeen: profile?.tutorialSeen ?? false,
    reflections: reflections.map((reflection) => ({
      appointmentId: reflection.appointmentId,
      startsAt: reflection.appointment.startsAt.toISOString(),
      status: reflection.appointment.status,
      therapistName: reflection.appointment.psychologist.psyProfile?.name ?? reflection.appointment.psychologist.firstName ?? "Специалист",
      preparation: dec(reflection.preparation),
      takeaway: dec(reflection.takeaway),
      feeling: reflection.feeling,
      updatedAt: reflection.updatedAt.toISOString(),
    })),
    notesModule: {
      enabled: client?.notesModuleEnabled ?? false,
      shared: client?.notesModuleShared ?? true,
      psychologistEnabled: client?.notesModulePsychologist ?? false,
    },
  };
}

export type TherapyPatch = {
  mood?: number;
  emotions?: string[];
  good?: string;
  board?: string;
  wheel?: Record<string, number[]>;
  tutorialSeen?: boolean;
  reflection?: {
    appointmentId: number;
    preparation?: string;
    takeaway?: string;
    feeling?: number | null;
  };
  notesModule?: { enabled?: boolean; shared?: boolean };
};

export async function patchTherapy(clientId: number, patch: TherapyPatch, opts: { allCards?: boolean } = {}): Promise<TherapyDTO> {
  const day = dayKey();
  const card = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, userId: true } });
  // Пишем туда же, откуда читаем: иначе отметка настроения уходила в карточку
  // второго психолога, а экран клиента показывал историю первой.
  const ownerId = card ? await therapyOwnerId(card) : clientId;

  if (patch.notesModule) {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(patch.notesModule.enabled !== undefined ? { notesModuleEnabled: patch.notesModule.enabled } : {}),
        ...(patch.notesModule.shared !== undefined ? { notesModuleShared: patch.notesModule.shared } : {}),
      },
    });
  }

  // Настроение: одна отметка на день, повторная правит существующую.
  if (patch.mood !== undefined || patch.emotions !== undefined) {
    const mood = patch.mood === undefined ? undefined : Math.min(5, Math.max(1, Math.round(Number(patch.mood))));
    const emotions = Array.isArray(patch.emotions) ? patch.emotions.map(String).slice(0, 12) : undefined;
    await prisma.mood.upsert({
      where: { clientId_day: { clientId: ownerId, day } },
      create: { clientId: ownerId, day, mood: mood ?? 3, emotions: emotions ?? [] },
      update: { ...(mood !== undefined ? { mood } : {}), ...(emotions !== undefined ? { emotions } : {}) },
    });
  }

  if (typeof patch.good === "string") {
    const text = patch.good.trim().slice(0, 240);
    if (text) {
      await prisma.goodNote.upsert({
        where: { clientId_day: { clientId: ownerId, day } },
        create: { clientId: ownerId, day, text: enc(text) },
        update: { text: enc(text) },
      });
    } else {
      await prisma.goodNote.deleteMany({ where: { clientId: ownerId, day } });
    }
  }

  // wheel не бывает null в патче: колесо либо прислали, либо нет.
  const profilePatch: { board?: string; wheel?: NonNullable<WheelDTO>; tutorialSeen?: boolean } = {};
  if (typeof patch.board === "string") profilePatch.board = enc(patch.board.slice(0, 4000));
  if (patch.wheel && typeof patch.wheel === "object") {
    const answers: Record<string, number[]> = {};
    for (const [k, list] of Object.entries(patch.wheel)) {
      answers[k] = (Array.isArray(list) ? list : []).map((v) => Math.min(10, Math.max(0, Number(v))));
    }
    profilePatch.wheel = { answers, completedAt: new Date().toISOString() };
  }
  if (patch.tutorialSeen !== undefined) profilePatch.tutorialSeen = Boolean(patch.tutorialSeen);

  if (Object.keys(profilePatch).length > 0) {
    await prisma.therapyProfile.upsert({
      where: { clientId: ownerId },
      create: {
        clientId: ownerId,
        board: profilePatch.board ?? "",
        wheel: profilePatch.wheel ?? undefined,
        tutorialSeen: profilePatch.tutorialSeen ?? false,
      },
      update: {
        ...(profilePatch.board !== undefined ? { board: profilePatch.board } : {}),
        ...(profilePatch.wheel !== undefined ? { wheel: profilePatch.wheel } : {}),
        ...(profilePatch.tutorialSeen !== undefined ? { tutorialSeen: profilePatch.tutorialSeen } : {}),
      },
    });
  }

  if (patch.reflection) {
    // Встреча ищется по всем карточкам человека, а не только по той, через
    // которую пришёл запрос: подготовка к сессии со вторым психологом иначе
    // не сохранялась. Модуль заметок при этом спрашивается у карточки самой
    // встречи — разрешение даёт та пара «клиент — психолог», а не соседняя.
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: patch.reflection.appointmentId,
        status: { not: "cancelled" },
        ...(card?.userId ? { client: { userId: card.userId } } : { clientId }),
      },
      select: { id: true, clientId: true, client: { select: { notesModuleEnabled: true } } },
    });
    if (appointment && appointment.client.notesModuleEnabled) {
      const preparation = patch.reflection.preparation === undefined ? undefined : enc(patch.reflection.preparation.trim().slice(0, 2000));
      const takeaway = patch.reflection.takeaway === undefined ? undefined : enc(patch.reflection.takeaway.trim().slice(0, 2000));
      const feeling = patch.reflection.feeling === undefined
        ? undefined
        : patch.reflection.feeling === null
          ? null
          : Math.min(10, Math.max(1, Math.round(patch.reflection.feeling)));
      await prisma.sessionReflection.upsert({
        where: { appointmentId: appointment.id },
        create: {
          clientId: appointment.clientId,
          appointmentId: appointment.id,
          preparation: preparation ?? "",
          takeaway: takeaway ?? "",
          feeling: feeling ?? null,
        },
        update: {
          ...(preparation !== undefined ? { preparation } : {}),
          ...(takeaway !== undefined ? { takeaway } : {}),
          ...(feeling !== undefined ? { feeling } : {}),
        },
      });
    }
  }

  return getTherapy(clientId, opts);
}

export async function setPsychologistNotesModule(clientId: number, enabled: boolean): Promise<TherapyDTO> {
  await prisma.client.update({
    where: { id: clientId },
    data: enabled
      ? { notesModulePsychologist: true, notesModuleEnabled: true }
      : { notesModulePsychologist: false },
  });
  return getTherapy(clientId);
}

/**
 * Карточка клиента, привязанная к этому пользователю. Через неё клиент видит
 * свои настроение и задания: карточку ведёт психолог, но данные — человека.
 */
export async function myClientCard(userId: number) {
  return prisma.client.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
}

/**
 * Карточка для записи терапии. Если человек ещё не записан ни к кому — заводим
 * личную, без психолога: раньше сервер в этом случае возвращал пустой ответ и
 * молча выбрасывал патч, и настроение с колесом баланса не сохранялись вовсе.
 * Когда он потом запишется, карточка у психолога появится рядом, а история
 * останется в этой — она старше, и владельцем терапии считается именно она.
 */
export async function ensureMyClientCard(user: { id: number; firstName: string | null }) {
  return (
    (await myClientCard(user.id)) ??
    prisma.client.create({
      data: { userId: user.id, name: user.firstName ?? "Клиент", link: "joined", status: "new" },
    })
  );
}

/** Карточка принадлежит этому психологу? Защита от чужих id в пути. */
export async function ownedClient(clientId: number, psychologistId: number) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  return client && client.psychologistId === psychologistId ? client : null;
}

export const decryptText = dec;
export const encryptText = enc;
