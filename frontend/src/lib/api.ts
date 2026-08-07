// Тонкий клиент API. Токены живут только в httpOnly-cookie.

import { DEMO, mockFetch } from "@/lib/demo";

// Бэкенд внутри Next — тот же origin, префикс /api.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: "POST" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // В демо не ходим в сеть — отвечаем из мок-хранилища.
  if (DEMO) return mockFetch<T>(path, init);

  const doRequest = () => {
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  };

  let res = await doRequest();
  if (res.status === 401 && (await tryRefresh())) {
    res = await doRequest();
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function hasLiveSession(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/me`);
  if (res.ok) return true;
  if (res.status !== 401 || !(await tryRefresh())) return false;
  return (await fetch(`${API_URL}/auth/me`)).ok;
}

// Почему вход не состоялся: сервер не ответил вовсе или отказал.
// Пользователю это разные истории, поэтому различаем их здесь.
export type LoginFailure = "offline" | "rejected";

export class LoginError extends Error {
  constructor(readonly kind: LoginFailure, message: string, readonly detail = "") {
    super(message);
    this.name = "LoginError";
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ручки входа отвечают человеческим текстом в поле `error` — его и показываем.
 * Через `apiFetch` это не проходит: он склеивает статус с телом и превращает
 * «Код истёк» в «API 401: {…}».
 */
async function authPost(path: string, body: Record<string, string>): Promise<void> {
  if (DEMO) {
    await mockFetch(path, { method: "POST", body: JSON.stringify(body) });
    return;
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new LoginError("offline", "Сервер не отвечает — попробуйте ещё раз", String(error));
  }
  if (res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  const message = data.error ?? (res.status === 429 ? "Слишком часто. Подождите минуту" : `Не получилось (${res.status})`);
  throw new LoginError(res.status >= 500 ? "offline" : "rejected", message, `${res.status}`);
}

/**
 * Код на почту для входа из браузера. Ответ одинаковый для знакомого и
 * незнакомого адреса — это сделано на сервере намеренно, поэтому «код
 * отправлен» здесь не означает, что почта привязана к аккаунту.
 */
export const requestEmailCode = (email: string) => authPost("/auth/email/request", { email });

/** Проверка кода: сервер ставит куки сессии, дальше приложение открывается само. */
export const loginWithEmail = (email: string, code: string) => authPost("/auth/email/verify", { email, code });

/**
 * Вход по данным Telegram. Одна неудачная попытка — ещё не отказ: холодный
 * старт сервера, обрыв мобильной сети и 429 от лимитера проходят сами, если
 * подождать. Насовсем сдаёмся только когда сервер осознанно отверг подпись.
 */
export async function loginWithInitData(initData: string): Promise<void> {
  let last: LoginError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await wait(600 * attempt);
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ init_data: initData }),
      });
    } catch (error) {
      last = new LoginError("offline", "Сервер недоступен", String(error));
      continue;
    }
    if (res.ok) return;
    const body = (await res.text().catch(() => "")).slice(0, 300);
    // 5xx и 429 — временные: пробуем ещё. Остальные 4xx означают, что данные
    // не приняли, и повтор ничего не изменит.
    const retriable = res.status >= 500 || res.status === 429;
    last = new LoginError(retriable ? "offline" : "rejected", `Вход отклонён (${res.status})`, `${res.status} ${body}`);
    if (!retriable) break;
  }
  throw last ?? new LoginError("offline", "Вход не удался");
}
