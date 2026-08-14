"use client";

import { apiFetch } from "@/lib/api";
import { APP_NAME, botDeepLink } from "@/lib/brand";

/**
 * Приглашение клиента. Ссылка ведёт в мини-приложение бота, а не на сайт:
 * человек сразу оказывается внутри, под своим Telegram-аккаунтом, и карточка
 * специалиста цепляется к нему без единого поля для ввода.
 *
 * Метка в ссылке короткая (`psy_12-Ab3xY9pQ`) — Telegram пускает в startapp
 * только 64 символа из `A-Za-z0-9_-`.
 */

export type InviteKind = "psy" | "card";

/** Текст приглашения — один на все места, откуда его отправляют. */
export const INVITE_TEXT = `Приглашаю Вас на платформу «${APP_NAME}» для дальнейшего комфортного взаимодействия. Здесь вы сможете записаться ко мне сессию`;

const PREFIX: Record<InviteKind, string> = { psy: "psy", card: "inv" };

export const inviteDeepLink = (kind: InviteKind, token: string) => botDeepLink(`${PREFIX[kind]}_${token}`);

export const inviteShareLink = (link: string, text = INVITE_TEXT) =>
  `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;

/** Метка из ссылки: `psy_<код>` или `inv_<код>`. */
export function readInvitePayload(payload: string): { kind: InviteKind; token: string } | null {
  const m = /^(psy|inv)_(.+)$/.exec(payload);
  if (!m) return null;
  return { kind: m[1] === "psy" ? "psy" : "card", token: m[2] };
}

export type InvitePreview = {
  kind: InviteKind;
  psy: { id: number; name: string; photo: string; method: string; city: string };
};

/** Общая ссылка специалиста — одна на всех клиентов. */
export const getPsyInviteToken = () => apiFetch<{ token: string }>("/invite/link");

export const getInvitePreview = (token: string) =>
  apiFetch<InvitePreview>(`/invite/preview?token=${encodeURIComponent(token)}`);

/** Принять общую ссылку: карточка у специалиста заводится этим вызовом. */
export const acceptPsyInvite = (token: string) =>
  apiFetch<{ ok: boolean; clientId: number }>("/invite/accept", { method: "POST", body: JSON.stringify({ token }) });
