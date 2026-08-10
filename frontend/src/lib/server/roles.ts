// Роли аккаунта и состояние верификации.
//
// Одиночная строка `role` больше не читается и не пишется: код целиком живёт
// на `roles`. Сама колонка ещё стоит в базе — её снимает следующий релиз
// (UPDATES.md, удаление в два захода), чтобы откат образа не остался без поля.
// Все проверки прав ходят сюда, а не сравнивают роль по месту.

import { prisma } from "@/lib/server/prisma";

export type Role = "client" | "psychologist";
export type PsyStatus = "none" | "draft" | "review" | "approved" | "rejected";

/**
 * Роли пользователя. Пустой массив — это клиент, а не аккаунт без ролей:
 * запись могла прийти из места, где роли не выбирали вовсе.
 */
export function rolesOf(user: { roles?: string[] | null }): Role[] {
  const list = user.roles?.length ? user.roles : ["client"];
  return list.filter((r): r is Role => r === "client" || r === "psychologist");
}

export function hasRole(user: { roles?: string[] | null }, role: Role): boolean {
  return rolesOf(user).includes(role);
}

/**
 * Роль, в которой человек работает. Хранится в базе, чтобы не расходиться
 * между устройствами. Психолога отдаём только тому, у кого роль есть: её могли
 * снять в админке, пока человек сидел в кабинете на другом компьютере.
 */
export function activeRoleOf(user: { roles?: string[] | null; activeRole?: string | null }): Role {
  const value = user.activeRole === "psychologist" ? "psychologist" : "client";
  return value === "psychologist" && hasRole(user, "psychologist") ? "psychologist" : "client";
}

/** Статус верификации с тем же фолбэком на анкету для незабэкофилленных строк. */
export function psyStatusOf(user: { psyStatus?: string | null }): PsyStatus {
  const value = user.psyStatus ?? "none";
  return (["none", "draft", "review", "approved", "rejected"] as const).includes(value as PsyStatus)
    ? (value as PsyStatus)
    : "none";
}

/**
 * Выдать роль психолога. Клиентскую не отбираем: заявка на верификацию не
 * должна закрывать человеку его собственную терапию.
 */
export async function grantPsychologist(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { roles: true } });
  if (!user || hasRole(user, "psychologist")) return;
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [...new Set([...rolesOf(user), "psychologist"])] },
  });
}

/** Снять роль психолога (админка переводит человека обратно в клиенты). */
export async function revokePsychologist(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { roles: true } });
  if (!user) return;
  await prisma.user.update({
    where: { id: userId },
    data: { roles: rolesOf(user).filter((r) => r !== "psychologist") },
  });
}

/**
 * Статус верификации хранится в двух местах: в анкете (там его читает
 * модерация) и рядом с ролью (там его читают права). Меняем всегда парой,
 * иначе проверка доступа начнёт расходиться с тем, что видит модератор.
 */
export async function setPsyStatus(userId: number, status: PsyStatus): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { psyStatus: status } });
}
