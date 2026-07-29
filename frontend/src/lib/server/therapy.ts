// Терапия на сервере: настроение, записи «что хорошего», доска и колесо.
// Всё, что человек пишет о себе, — специальная категория ПД, поэтому тексты
// проходят через шифрование, а наружу отдаются в том же виде, что и в демо.

import { decryptField, encryptField, encryptionReady } from "@/lib/server/crypto";
import { prisma } from "@/lib/server/prisma";

export type MoodDTO = { date: string; mood: number; emotions?: string[] };
export type NoteDTO = { date: string; text: string };
export type WheelDTO = { answers: Record<string, number[]>; completedAt: string } | null;
export type TherapyDTO = {
  moods: MoodDTO[];
  notes: NoteDTO[];
  board: string;
  wheel: WheelDTO;
  tutorialSeen: boolean;
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

export async function getTherapy(clientId: number): Promise<TherapyDTO> {
  const [moods, notes, profile] = await Promise.all([
    prisma.mood.findMany({ where: { clientId }, orderBy: { day: "asc" }, take: 30 }),
    prisma.goodNote.findMany({ where: { clientId }, orderBy: { day: "asc" }, take: 60 }),
    prisma.therapyProfile.findUnique({ where: { clientId } }),
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
  };
}

export type TherapyPatch = {
  mood?: number;
  emotions?: string[];
  good?: string;
  board?: string;
  wheel?: Record<string, number[]>;
  tutorialSeen?: boolean;
};

export async function patchTherapy(clientId: number, patch: TherapyPatch): Promise<TherapyDTO> {
  const day = dayKey();

  // Настроение: одна отметка на день, повторная правит существующую.
  if (patch.mood !== undefined || patch.emotions !== undefined) {
    const mood = patch.mood === undefined ? undefined : Math.min(5, Math.max(1, Math.round(Number(patch.mood))));
    const emotions = Array.isArray(patch.emotions) ? patch.emotions.map(String).slice(0, 12) : undefined;
    await prisma.mood.upsert({
      where: { clientId_day: { clientId, day } },
      create: { clientId, day, mood: mood ?? 3, emotions: emotions ?? [] },
      update: { ...(mood !== undefined ? { mood } : {}), ...(emotions !== undefined ? { emotions } : {}) },
    });
  }

  if (typeof patch.good === "string") {
    const text = patch.good.trim().slice(0, 240);
    if (text) {
      await prisma.goodNote.upsert({
        where: { clientId_day: { clientId, day } },
        create: { clientId, day, text: enc(text) },
        update: { text: enc(text) },
      });
    } else {
      await prisma.goodNote.deleteMany({ where: { clientId, day } });
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
      where: { clientId },
      create: {
        clientId,
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

  return getTherapy(clientId);
}

/**
 * Карточка клиента, привязанная к этому пользователю. Через неё клиент видит
 * свои настроение и задания: карточку ведёт психолог, но данные — человека.
 */
export async function myClientCard(userId: number) {
  return prisma.client.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
}

/** Карточка принадлежит этому психологу? Защита от чужих id в пути. */
export async function ownedClient(clientId: number, psychologistId: number) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  return client && client.psychologistId === psychologistId ? client : null;
}

export const decryptText = dec;
export const encryptText = enc;
