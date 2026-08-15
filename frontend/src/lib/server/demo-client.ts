import { prisma } from "@/lib/server/prisma";
// Тот же `enc`, что у остального содержимого терапии: без ключа шифрования он
// пропускает текст как есть, иначе карточка-пример читалась бы шифром.
import { encryptText } from "@/lib/server/therapy";

/**
 * Карточка-пример для нового специалиста.
 *
 * Пустой раздел «Клиенты» ничего не объясняет: человек не видит, ради чего
 * заполнять заметки, зачем задания и что показывает статистика. Поэтому при
 * первом заходе заводим одну живую карточку — с историей сессий, заметками,
 * заданиями, настроением и колесом баланса.
 *
 * Она помечена `demo`: место в лимите бесплатного тарифа не занимает, в
 * публичные счётчики каталога не попадает и отсчёт пробного PRO не запускает.
 * Удаляется как обычная карточка и больше не возвращается.
 */

const DAY = 86_400_000;

// Дни считаем от полуночи: отметка настроения — это день, а не момент.
function daysAgo(days: number, hour = 0): Date {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

// Три недели дневника: тяжёлое начало, ровная середина, подъём к концу.
const MOOD_TRACK: { back: number; mood: number; emotions: string[] }[] = [
  { back: 20, mood: 2, emotions: ["напряжение", "страх"] },
  { back: 19, mood: 2, emotions: ["печаль"] },
  { back: 18, mood: 3, emotions: ["напряжение"] },
  { back: 17, mood: 2, emotions: ["страх", "вина"] },
  { back: 16, mood: 3, emotions: ["облегчение"] },
  { back: 15, mood: 3, emotions: ["напряжение"] },
  { back: 13, mood: 4, emotions: ["облегчение", "интерес"] },
  { back: 12, mood: 3, emotions: ["печаль"] },
  { back: 11, mood: 3, emotions: ["напряжение"] },
  { back: 10, mood: 4, emotions: ["интерес"] },
  { back: 9, mood: 4, emotions: ["облегчение"] },
  { back: 8, mood: 3, emotions: ["страх"] },
  { back: 6, mood: 4, emotions: ["радость", "гордость"] },
  { back: 5, mood: 4, emotions: ["интерес"] },
  { back: 4, mood: 5, emotions: ["радость"] },
  { back: 3, mood: 4, emotions: ["облегчение"] },
  { back: 2, mood: 4, emotions: ["интерес", "гордость"] },
  { back: 1, mood: 5, emotions: ["радость", "облегчение"] },
];

// Колесо баланса: по три ответа на сферу, 0–10. Провалы — работа и отдых,
// опора — семья и друзья: сразу видно, о чём разговор.
const WHEEL_ANSWERS: Record<string, number[]> = {
  health: [6, 5, 6],
  emotions: [4, 3, 5],
  relationships: [7, 6, 7],
  family: [8, 8, 7],
  social: [7, 6, 6],
  work: [3, 4, 3],
  finance: [5, 6, 5],
  growth: [6, 7, 6],
  leisure: [3, 3, 4],
  environment: [6, 6, 7],
};

export async function ensureDemoClient(psychologistId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: psychologistId },
    select: { demoClientSeeded: true },
  });
  if (!user || user.demoClientSeeded) return;

  // Только новичку. У действующего специалиста карточки уже есть, и пример
  // среди живых людей выглядел бы подставным клиентом, а не подсказкой.
  const clients = await prisma.client.count({ where: { psychologistId } });
  if (clients > 0) {
    await prisma.user.update({ where: { id: psychologistId }, data: { demoClientSeeded: true } });
    return;
  }

  // Метку ставим первой: если два запроса придут разом, карточка заведётся
  // один раз, а не в двух экземплярах.
  const claimed = await prisma.user.updateMany({
    where: { id: psychologistId, demoClientSeeded: false },
    data: { demoClientSeeded: true },
  });
  if (claimed.count === 0) return;

  const client = await prisma.client.create({
    data: {
      psychologistId,
      name: "Анна (пример)",
      status: "therapy",
      demo: true,
      // Заметка психолога хранится как есть: её роут не шифрует (см. PATCH
      // /api/clients/[id]) — зашифруй мы здесь, человек увидел бы абракадабру.
      note: [
        "Тревога перед защитой диплома, сон 4–5 часов.",
        "Хорошо отзывается на дыхание 4-7-8, дома делает через раз.",
        "Держим фокус на сне и опоре в семье.",
      ].join("\n"),
      createdAt: daysAgo(30),
    },
  });

  await prisma.appointment.createMany({
    data: [28, 21, 14, 7].map((back) => ({
      psychologistId,
      clientId: client.id,
      startsAt: daysAgo(back, 12),
      durationMin: 50,
      format: "online",
      status: "done",
    })),
  });

  await prisma.homework.createMany({
    data: [
      { clientId: client.id, text: "Дыхание 4-7-8 перед сном, 5 минут", status: "done", sentAt: daysAgo(21) },
      { clientId: client.id, text: "Дневник тревоги: ситуация → мысль → что помогло", status: "doing", sentAt: daysAgo(14) },
      { clientId: client.id, text: "Прогулка 20 минут без телефона", status: "assigned", sentAt: daysAgo(7) },
    ].map((row) => ({ ...row, text: encryptText(row.text) })),
  });

  await prisma.mood.createMany({
    data: MOOD_TRACK.map((point) => ({
      clientId: client.id,
      day: daysAgo(point.back),
      mood: point.mood,
      emotions: point.emotions,
    })),
  });

  await prisma.goodNote.createMany({
    data: [
      { clientId: client.id, day: daysAgo(9), text: "Пошла на встречу выпускников, хотя собиралась отменить" },
      { clientId: client.id, day: daysAgo(4), text: "Впервые за месяц выспалась" },
    ].map((row) => ({ ...row, text: encryptText(row.text) })),
  });

  await prisma.therapyProfile.create({
    data: {
      clientId: client.id,
      board: encryptText("Цель: спать 7 часов и дожить до защиты без паники."),
      wheel: { answers: WHEEL_ANSWERS, completedAt: new Date(Date.now() - 6 * DAY).toISOString() },
      tutorialSeen: true,
    },
  });
}
