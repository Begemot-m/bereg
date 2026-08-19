"use client";

import { apiFetch } from "@/lib/api";
import { APP_NAME, botStartLink } from "@/lib/brand";

/**
 * Приглашение клиента. Ссылка ведёт в мини-приложение бота, а не на сайт:
 * человек сразу оказывается внутри, под своим Telegram-аккаунтом, и карточка
 * специалиста цепляется к нему без единого поля для ввода.
 *
 * Метка в ссылке короткая (`psy_12-Ab3xY9pQ`) — Telegram пускает в startapp
 * только 64 символа из `A-Za-z0-9_-`.
 */

export type InviteKind = "psy" | "card" | "group";

/** Текст приглашения — один на все места, откуда его отправляют. */
export const INVITE_TEXT = `Приглашаю Вас на платформу «${APP_NAME}» для дальнейшего комфортного взаимодействия. Здесь вы сможете записаться ко мне сессию`;

const PREFIX: Record<InviteKind, string> = { psy: "psy", card: "inv", group: "grp" };

export const inviteDeepLink = (kind: InviteKind, token: string) => botStartLink(`${PREFIX[kind]}_${token}`);

export const inviteShareLink = (link: string, text = INVITE_TEXT) =>
  `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;

/** Метка из ссылки: `psy_<код>`, `inv_<код>` или `grp_<код>`. */
export function readInvitePayload(payload: string): { kind: InviteKind; token: string } | null {
  const m = /^(psy|inv|grp)_(.+)$/.exec(payload);
  if (!m) return null;
  const kind: InviteKind = m[1] === "psy" ? "psy" : m[1] === "grp" ? "group" : "card";
  return { kind, token: m[2] };
}

export type InvitePreview = {
  kind: InviteKind;
  psy: { id: number; name: string; photo: string; method: string; city: string };
  /** Только для приглашения в группу: куда именно зовут. */
  group?: { id: number; title: string; kind: "group" | "pair"; seats: number };
};

/** Общая ссылка специалиста — одна на всех клиентов. */
export const getPsyInviteToken = () => apiFetch<{ token: string }>("/invite/link");

export const getInvitePreview = (token: string) =>
  apiFetch<InvitePreview>(`/invite/preview?token=${encodeURIComponent(token)}`);

/** Принять общую ссылку: карточка у специалиста заводится этим вызовом. */
export const acceptPsyInvite = (token: string) =>
  apiFetch<{ ok: boolean; clientId: number }>("/invite/accept", { method: "POST", body: JSON.stringify({ token }) });
