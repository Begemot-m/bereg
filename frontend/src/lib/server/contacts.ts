// Клиент из контактов Telegram: карточка-визитка без синхронизации.
//
// Специалист выбирает человека в списке контактов, и карточка получает лицо,
// имя и ник — этого хватает, чтобы вести записи и написать в один тап.
// Аккаунт при этом не подключён (`link: none`): синхронизация настроения,
// заданий и записей начинается только после приглашения, отдельным решением.
//
// Сюда ходят двое: бот (нативный выбор контактов, `users_shared`) и роут
// `/api/clients/contacts` (быстрый путь по нику). Правила должны быть одни,
// поэтому лимит тарифа, проверка допуска и защита от дублей живут здесь.

import { canAddClient, psyApproved } from "@/lib/server/access";
import { prisma } from "@/lib/server/prisma";

export type TgContact = {
  /** id аккаунта в Telegram. Есть у выбранного контакта, у поиска по нику — не всегда. */
  userId?: number | null;
  name: string;
  username?: string | null;
  /** file_id аватарки: сам файл отдаёт `/api/clients/photo/<id>`. */
  photoId?: string | null;
};

export type AddedContact = { id: number; name: string; created: boolean };
export type AddContactsResult = {
  added: AddedContact[];
  /** Уперлись в лимит бесплатного тарифа: часть контактов не завелась. */
  limited: boolean;
  approved: boolean;
};

const cleanName = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 120) || "Клиент";
const cleanNick = (value?: string | null) => value?.trim().replace(/^@/, "").slice(0, 60) || null;

/**
 * Заводит карточки по выбранным контактам. Повторный выбор того же человека
 * карточку не дублирует — обновляет ник и аватарку: контакт мог сменить и то,
 * и другое, а карточка уже с историей встреч.
 */
export async function addContactClients(psychologistId: number, contacts: TgContact[]): Promise<AddContactsResult> {
  if (!(await psyApproved(psychologistId))) return { added: [], limited: false, approved: false };

  const added: AddedContact[] = [];
  let limited = false;

  for (const contact of contacts) {
    const name = cleanName(contact.name);
    const username = cleanNick(contact.username);
    const tgUserId = contact.userId ? BigInt(contact.userId) : null;

    const existing = await prisma.client.findFirst({
      where: {
        psychologistId,
        OR: [
          ...(tgUserId ? [{ tgUserId }, { user: { telegramId: tgUserId } }] : []),
          ...(username ? [{ tgUsername: username }] : []),
        ],
      },
      select: { id: true, name: true },
    });

    if (existing) {
      await prisma.client.update({
        where: { id: existing.id },
        data: {
          tgUserId: tgUserId ?? undefined,
          tgUsername: username ?? undefined,
          tgPhotoId: contact.photoId ?? undefined,
        },
      });
      added.push({ id: existing.id, name: existing.name, created: false });
      continue;
    }

    const limit = await canAddClient(psychologistId);
    if (!limit.ok) { limited = true; break; }

    const created = await prisma.client.create({
      data: {
        psychologistId,
        name,
        // Ник виден в карточке как контакт: «Написать» работает сразу, до
        // всякого подключения — ради этого выбор контакта и затевался.
        contact: username ? `@${username}` : null,
        tgUserId,
        tgUsername: username,
        tgPhotoId: contact.photoId ?? null,
      },
      select: { id: true, name: true },
    });
    added.push({ id: created.id, name: created.name, created: true });
  }

  return { added, limited, approved: true };
}
