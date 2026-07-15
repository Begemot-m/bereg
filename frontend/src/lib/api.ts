// Тонкий клиент API: хранит токены, добавляет Authorization, делает refresh при 401.

import { DEMO, mockFetch } from "@/lib/demo";

// Бэкенд внутри Next — тот же origin, префикс /api.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const ACCESS_KEY = "psy_access";
const REFRESH_KEY = "psy_refresh";

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccess(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);
}

async function tryRefresh(): Promise<boolean> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // В демо не ходим в сеть — отвечаем из мок-хранилища.
  if (DEMO) return mockFetch<T>(path, init);

  const doRequest = () => {
    const access = getAccess();
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
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

export async function loginWithInitData(initData: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ init_data: initData }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
}
