// Ограничение частоты запросов.
//
// Счётчики в памяти процесса, без Redis. Честное ограничение: при нескольких
// контейнерах лимит станет «на контейнер», а не общий. На нашем масштабе
// приложение одно, и это правильный размен — Redis ради лимитов на старте
// добавляет ещё один сервис, который может упасть.
//
// Алгоритм — скользящее окно по меткам времени: точнее фиксированного окна,
// в которое можно уложить двойную норму на стыке двух периодов.

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

// Раз в пять минут выкидываем протухшее, иначе карта растёт вечно.
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 5 * 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export type Limit = { limit: number; windowMs: number };

/** Готовые режимы: строгий — для входа и всего, что можно перебирать. */
export const LIMITS = {
  auth: { limit: 10, windowMs: 60_000 },      // вход: 10 попыток в минуту
  otp: { limit: 5, windowMs: 15 * 60_000 },   // код на почту: 5 за 15 минут
  write: { limit: 60, windowMs: 60_000 },     // обычные изменения
  public: { limit: 20, windowMs: 60_000 },    // формы без авторизации
} satisfies Record<string, Limit>;

/**
 * Проверить и зачесть попытку. Возвращает, разрешено ли, и через сколько
 * секунд можно повторить.
 */
export function hit(key: string, { limit, windowMs }: Limit): { ok: boolean; retryAfter: number } {
  sweep(windowMs);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, retryAfter: 0 };
}

/** Адрес запроса: за Caddy настоящий IP приходит в X-Forwarded-For. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Обёртка для роутов: вернёт готовый 429, если лимит исчерпан, иначе null.
 *
 *   const stop = limited(req, "support", LIMITS.public);
 *   if (stop) return stop;
 */
export function limited(req: Request, scope: string, mode: Limit): Response | null {
  const { ok, retryAfter } = hit(`${scope}:${clientIp(req)}`, mode);
  if (ok) return null;
  return new Response(
    JSON.stringify({ error: "too_many_requests", message: "Слишком часто. Попробуйте чуть позже.", retryAfter }),
    { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) } },
  );
}
