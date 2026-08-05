"use client";

import { useEffect, useState } from "react";

export type Role = "guest" | "client" | "psychologist";

export const ROLE_LABEL: Record<Role, string> = {
  guest: "Гость",
  client: "Клиент",
  psychologist: "Психолог",
};

const KEY = "psy_demo_role";
const EVENT = "opora-role-change";

// Роль по умолчанию — клиент. Кабинет психолога открывается только тем, кто
// выбрал эту роль в онбординге или подал заявку: дефолт «психолог» означал,
// что любой новый человек сразу попадал в чужой по смыслу кабинет.
export function getRole(): Role {
  if (typeof window === "undefined") return "client";
  return (localStorage.getItem(KEY) as Role) || "client";
}

export function setRole(role: Role) {
  localStorage.setItem(KEY, role);
  window.dispatchEvent(new CustomEvent(EVENT));
}

// Что человек выбрал в онбординге. Нужно ровно для переключателя ролей в
// кабинете: тому, кто зашёл клиентом и не имеет учётной записи психолога,
// быстрое переключение показывать незачем.
const INTENT_KEY = "psy_role_intent";

export function setRoleIntent(role: Role) {
  localStorage.setItem(INTENT_KEY, role);
}

export function getRoleIntent(): Role | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(INTENT_KEY) as Role) || null;
}

/**
 * Третьим элементом — прочитана ли роль из localStorage.
 *
 * На первом рендере роли ещё нет: страница собирается на сборке, а хранилище
 * доступно только в браузере, — и до эффекта любой читает дефолтного клиента.
 * Для разметки это мигание, но для редиректов ложь: психолог, открывший
 * «Сессии», успевал уехать в «Терапию» раньше, чем роль подтягивалась.
 */
export function useRole(): [Role, (r: Role) => void, boolean] {
  const [role, setLocal] = useState<Role>("client");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocal(getRole());
    setReady(true);
    const onChange = () => setLocal(getRole());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  return [role, setRole, ready];
}
