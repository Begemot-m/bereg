"use client";

import { useEffect, useState } from "react";

export type Role = "guest" | "client" | "psychologist";

export const ROLE_LABEL: Record<Role, string> = {
  guest: "Гость",
  client: "Пользователь",
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
  const changed = getRole() !== role;
  localStorage.setItem(KEY, role);
  lastLocalChoice = Date.now();
  window.dispatchEvent(new CustomEvent(EVENT));
  // Роль в базе трогаем только при настоящей смене: оболочка вызывает setRole
  // на каждом входе по ссылке, и без этой проверки каждый такой заход писал
  // в базу то, что там и так лежит.
  if (changed) void pushRole(role);
}

/**
 * Выбор роли уезжает в базу. Пока он жил только в localStorage, человек,
 * зарегистрировавшийся психологом с телефона, открывал на десктопе
 * клиентский интерфейс — там роли просто не было.
 *
 * «Гость» на сервер не отправляем: это состояние экрана до входа, а не роль
 * аккаунта.
 */
async function pushRole(role: Role) {
  if (role === "guest") return;
  const { apiFetch } = await import("@/lib/api");
  await apiFetch("/profile/role", { method: "POST", body: JSON.stringify({ active: role }) }).catch(() => {});
}

/**
 * Роль, сохранённая на сервере, применяется к этому устройству. Свежий
 * локальный выбор не перебиваем: ответ отстаёт на секунду-другую, а человек
 * мог за это время переключиться сам.
 */
export function applyServerRole(active: Role, roles: Role[]) {
  if (typeof window === "undefined") return;
  if (Date.now() - lastLocalChoice < 10_000) return;
  // Переключатель ролей в кабинете показывается по намерению. Оно приходит
  // отсюда же: роль психолога есть в аккаунте — значит есть и намерение,
  // даже когда человек сейчас работает клиентом.
  const intent: Role = roles.includes("psychologist") ? "psychologist" : "client";
  const changed = getRole() !== active || getRoleIntent() !== intent;
  if (!changed) return;
  localStorage.setItem(KEY, active);
  localStorage.setItem(INTENT_KEY, intent);
  window.dispatchEvent(new CustomEvent(EVENT));
}

let lastLocalChoice = 0;

// Что человек выбрал в онбординге. Нужно ровно для переключателя ролей в
// кабинете: тому, кто зашёл клиентом и не имеет учётной записи психолога,
// быстрое переключение показывать незачем.
const INTENT_KEY = "psy_role_intent";

export function setRoleIntent(role: Role) {
  localStorage.setItem(INTENT_KEY, role);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getRoleIntent(): Role | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(INTENT_KEY) as Role) || null;
}

/**
 * Намерение читается так же, как роль: на сервере его нет, а меняться оно
 * может прямо в открытом кабинете — когда клиент переключается в психологи.
 *
 * Вторым элементом — прочитано ли оно. До первого эффекта «намерения нет» и
 * «ещё не смотрели» выглядят одинаково, и страж кабинета на этом отправлял
 * свежего психолога обратно в клиенты.
 */
export function useRoleIntent(): [Role | null, boolean] {
  const [intent, setIntent] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => { setIntent(getRoleIntent()); setReady(true); };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);

  return [intent, ready];
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
