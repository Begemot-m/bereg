// Роли аккаунта и состояние верификации.
//
// Переход с одиночной строки `role` идёт в два релиза (UPDATES.md): пока код
// пишет в оба поля, а решения принимает по `roles`. Все места, где раньше
// стояло `user.role === "psychologist"`, ходят сюда — иначе половина проверок
// останется на старом поле и разъедется с новым.

import { prisma } from "@/lib/server/prisma";

export type Role = "client" | "psychologist";
export type PsyStatus = "none" | "draft" | "review" | "approved" | "rejected";

/**
 * Роли пользователя. Пустой массив означает запись, до которой не дошёл
 * бэкофилл: выводим её из старой строки, а не считаем человека без ролей.
 */
export function rolesOf(user: { roles?: string[] | null; role?: string | null }): Role[] {
  const list = user.roles?.length ? user.roles : user.role === "psychologist" ? ["client", "psychologist"] : ["client"];
  return list.filter((r): r is Role => r === "client" || r === "psychologist");
}

export function hasRole(user: { roles?: string[] | null; role?: string | null }, role: Role): boolean {
  return rolesOf(user).includes(role);
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
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { roles: true, role: true } });
  if (!user || hasRole(user, "psychologist")) return;
  await prisma.user.update({
    where: { id: userId },
    // Строку role пишем вместе с массивом до второго релиза перехода.
    data: { roles: [...new Set([...rolesOf(user), "psychologist"])], role: "psychologist" },
  });
}

/** Снять роль психолога (админка переводит человека обратно в клиенты). */
export async function revokePsychologist(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { roles: true, role: true } });
  if (!user) return;
  await prisma.user.update({
    where: { id: userId },
    data: { roles: rolesOf(user).filter((r) => r !== "psychologist"), role: "client" },
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
