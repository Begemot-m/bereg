import { NextResponse, type NextRequest } from "next/server";

/**
 * Проверка источника для всех изменяющих запросов к API.
 *
 * В проде куки `SameSite=None` — иначе Telegram Web не донесёт их до Mini App
 * во внешнем iframe (`lib/server/sessions.ts`). Значит браузер отдаёт их и при
 * запросе с чужой страницы, и эта проверка — не вторая линия, а единственная:
 * у POST/PATCH/PUT/DELETE должен совпадать источник. Локально SameSite=Lax.
 *
 * Делается здесь, а не в каждом роуте: пятнадцать одинаковых вызовов рано
 * или поздно забудут в шестнадцатом.
 *
 * Исключения:
 *   — вебхук ЮKassa приходит с их серверов и Origin не несёт вовсе;
 *   — GET и HEAD ничего не меняют.
 */

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const NO_ORIGIN_NEEDED = ["/api/billing/webhook"];

export function middleware(req: NextRequest) {
  if (SAFE.has(req.method)) return NextResponse.next();
  if (NO_ORIGIN_NEEDED.some((path) => req.nextUrl.pathname.startsWith(path))) return NextResponse.next();

  const origin = req.headers.get("origin");
  // Запрос без Origin — это не браузер (curl, серверный клиент, мобильный
  // вебвью старой версии). Пропускаем: подделать чужой куки таким способом
  // всё равно нельзя, браузер их не отдаст.
  if (!origin) return NextResponse.next();

  const allowed = process.env.APP_URL;
  const sameHost = origin === req.nextUrl.origin || (allowed && origin === allowed);
  if (sameHost) return NextResponse.next();

  return NextResponse.json(
    { error: "bad_origin", message: "Запрос пришёл с чужого адреса" },
    { status: 403 },
  );
}

export const config = { matcher: "/api/:path*" };
