import crypto from "node:crypto";

/**
 * Вход с компьютера по QR-коду.
 *
 * Сайт просит код, рисует его QR-кодом со ссылкой на бота. Человек сканирует
 * телефоном, Telegram открывает чат бота, бот показывает, откуда просят вход, и
 * ждёт подтверждения кнопкой. Только после нажатия сайт получает сессию.
 *
 * Подтверждение обязательно и не заменяется фактом сканирования: иначе чужой QR
 * («отсканируйте, чтобы получить скидку») отдаёт злоумышленнику живую сессию
 * жертвы. Кнопка с описанием браузера — единственное место, где человек может
 * заметить, что вход просит не он.
 */

/** Сколько живёт неподтверждённый код. Две минуты — успеть отсканировать. */
export const CODE_TTL_MS = 2 * 60_000;
/** Подтверждённый код обменивается на сессию сразу; запас — на медленный поллинг. */
export const APPROVED_TTL_MS = 60_000;

export type CodeStatus = "pending" | "approved" | "used" | "rejected";

export type CodeRow = {
  status: string;
  userId: number | null;
  expiresAt: Date;
  approvedAt: Date | null;
  usedAt: Date | null;
};

/**
 * Код для ссылки. Только буквы и цифры: он едет в стартовой метке Telegram, а
 * там разрешён узкий алфавит (A-Z, a-z, 0-9, _ и -).
 */
export function newCode(): string {
  return crypto.randomBytes(24).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 28);
}

export const hashCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

/** Метка для ссылки в бота: её разбирает и бот, и StartRoute. */
export const codePayload = (code: string) => `login_${code}`;

/** Код из метки. Чужие метки и мусор отсекаются здесь, а не в обработчике. */
export function readPayload(payload: string): string | null {
  const found = /^login_([A-Za-z0-9]{16,40})$/.exec(payload.trim());
  return found ? found[1] : null;
}

/**
 * Что сайт должен показать по строке кода. Отдельная чистая функция, потому что
 * это и есть решение «пускать или нет» — на неё стоит тест.
 */
export function codeState(row: CodeRow | null, now = new Date()): { state: "unknown" | "pending" | "approved" | "expired" | "used" | "rejected"; userId?: number } {
  if (!row) return { state: "unknown" };
  if (row.status === "rejected") return { state: "rejected" };
  if (row.status === "used" || row.usedAt) return { state: "used" };

  if (row.status === "approved" && row.userId) {
    // У подтверждённого кода свой срок: он отсчитывается от подтверждения, а не
    // от выдачи, иначе одобрение на последней секунде уже некуда обменять.
    const deadline = (row.approvedAt?.getTime() ?? 0) + APPROVED_TTL_MS;
    return now.getTime() > deadline ? { state: "expired" } : { state: "approved", userId: row.userId };
  }

  if (row.expiresAt.getTime() <= now.getTime()) return { state: "expired" };
  return { state: "pending" };
}

/**
 * Как подписать запрос в Telegram. Человеку нужно узнать своё устройство, а не
 * прочитать строку User-Agent целиком.
 */
export function describeClient(userAgent: string | null, ip: string | null): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && !/Chrome\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "браузер";
  const os = /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  const where = [browser, os].filter(Boolean).join(" · ");
  return ip ? `${where} · IP ${ip}` : where;
}
