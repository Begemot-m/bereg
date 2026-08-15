"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { asset } from "@/lib/asset";

/**
 * Лицо клиента везде, где он появляется: в списке, в карточке, в записях.
 * Фото приходит из Telegram и только у тех, кто подключил свой профиль, —
 * у остальных остаётся буква имени, как было раньше.
 *
 * Ссылка на аватарку живёт на серверах Telegram и однажды перестаёт отдавать
 * картинку. Битую иконку вместо человека показывать нельзя, поэтому на ошибке
 * загрузки молча возвращаемся к букве.
 */
export function ClientAvatar({
  name,
  photo,
  className,
  style,
}: {
  name: string;
  photo?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo]);

  const letter = name.trim().charAt(0).toUpperCase() || "К";
  // asset() нужен демо-данным (картинка из public живёт под basePath); ссылку
  // Telegram он пропускает как есть.
  const src = photo && !broken ? asset(photo) : null;

  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden ${className ?? ""}`} style={style}>
      {src ? (
        // Ленивая загрузка и асинхронное декодирование: в списке клиентов и в
        // сетке окон таких картинок десятки, и все они грузились разом, отбирая
        // канал у данных экрана.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        letter
      )}
    </span>
  );
}
