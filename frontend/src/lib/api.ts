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
  constructor(readonly kind: LoginFailure, message: string) {
    super(message);
    this.name = "LoginError";
  }
}

export async function loginWithInitData(initData: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ init_data: initData }),
    });
  } catch (error) {
    throw new LoginError("offline", `Сервер недоступен: ${String(error)}`);
  }
  if (res.ok) return;
  // 5xx — приложение на той стороне не поднялось; 4xx — данные не приняты.
  throw new LoginError(res.status >= 500 ? "offline" : "rejected", `Auth failed: ${await res.text()}`);
}
