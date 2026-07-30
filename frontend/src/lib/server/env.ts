// Серверные переменные окружения.
//
// Принцип: приложение не должно молча работать с небезопасным значением.
// Раньше JWT_SECRET имел дефолт "dev-insecure-secret-change-me" — если бы его
// забыли задать в проде, все токены подписывались бы известным ключом.
// Поэтому в проде отсутствие секрета — падение при старте, а не предупреждение.

const isProd = process.env.NODE_ENV === "production";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function secret(name: string, minLength = 32): string {
  const value = process.env[name];
  if (!value) {
    if (isProd) throw new Error(`Missing secret: ${name}`);
    return `dev-only-${name.toLowerCase()}`;
  }
  if (isProd && value.length < minLength) {
    throw new Error(`Secret ${name} is too short: need at least ${minLength} characters`);
  }
  return value;
}

export const env = {
  isProd,
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get telegramBotToken() {
    return required("TELEGRAM_BOT_TOKEN");
  },
  get jwtSecret() {
    return secret("JWT_SECRET");
  },
  /** Публичный адрес приложения — нужен для ссылок в письмах и проверки Origin. */
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  initDataMaxAgeSeconds: Number(process.env.INITDATA_MAX_AGE_SECONDS ?? 86400),
  accessTtlSeconds: Number(process.env.ACCESS_TTL_SECONDS ?? 15 * 60),
  refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS ?? 60),
  /** Версия политики обработки ПД: меняется — пользователь пересогласовывает. */
  policyVersion: process.env.POLICY_VERSION ?? "2026-07-01",
};

/**
 * Проверка окружения при старте. Вызывается из instrumentation.ts, чтобы
 * контейнер падал сразу, а не на первом запросе пользователя.
 */
export function assertEnv() {
  const missing: string[] = [];
  for (const name of ["DATABASE_URL", "TELEGRAM_BOT_TOKEN", "JWT_SECRET", "DATA_KEY", "APP_URL"]) {
    if (!process.env[name]) missing.push(name);
  }
  if (isProd && missing.length) {
    throw new Error(`Не заданы обязательные переменные окружения: ${missing.join(", ")}`);
  }
  if (!isProd) return;

  void env.jwtSecret;
  const appUrl = new URL(env.appUrl);
  if (appUrl.protocol !== "https:") throw new Error("APP_URL в production должен использовать https");

  const dataKey = Buffer.from(required("DATA_KEY"), "base64");
  if (dataKey.length !== 32) throw new Error("DATA_KEY должен содержать 32 байта в base64");

  for (const [name, value] of [
    ["INITDATA_MAX_AGE_SECONDS", env.initDataMaxAgeSeconds],
    ["ACCESS_TTL_SECONDS", env.accessTtlSeconds],
    ["REFRESH_TTL_DAYS", env.refreshTtlDays],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} должен быть положительным числом`);
  }
}
