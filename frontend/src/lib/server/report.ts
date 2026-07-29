// Отчёт об ошибках.
//
// Sentry можно подключить позже одной переменной, но узнавать о поломках
// нужно с первого дня. Пока шлём в Telegram: бот уже есть, стоит ноль,
// приходит мгновенно. В лог пишем структурно, чтобы `docker logs` можно
// было грепать, а не читать глазами.
//
// В сообщение не попадает ничего пользовательского: путь, тип ошибки и
// первые строки стека. Тексты запросов и ПД сюда не уезжают — иначе алерты
// сами станут утечкой.

type Context = { route?: string; method?: string; userId?: number };

const CHAT = process.env.ALERT_CHAT_ID;
const BOT = process.env.TELEGRAM_BOT_TOKEN;

// Не заваливаем чат одинаковыми сообщениями при массовой поломке.
const recent = new Map<string, number>();
const MUTE_MS = 5 * 60_000;

function shouldSend(signature: string): boolean {
  const now = Date.now();
  const last = recent.get(signature) ?? 0;
  if (now - last < MUTE_MS) return false;
  recent.set(signature, now);
  if (recent.size > 200) recent.clear();
  return true;
}

export async function reportError(error: unknown, ctx: Context = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const where = `${ctx.method ?? "?"} ${ctx.route ?? "?"}`;
  const signature = `${where}:${err.message}`;

  // Структурная строка — её удобно искать и парсить.
  console.error(JSON.stringify({
    level: "error",
    at: new Date().toISOString(),
    route: ctx.route,
    method: ctx.method,
    userId: ctx.userId,
    error: err.message,
    stack: err.stack?.split("\n").slice(0, 4).join(" | "),
  }));

  if (!CHAT || !BOT || !shouldSend(signature)) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT,
        text: `⚠️ Ошибка в ${where}\n${err.message}\n\n${err.stack?.split("\n")[1]?.trim() ?? ""}`,
        disable_notification: false,
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Молча: падать из-за неотправленного алерта — худшее, что можно сделать.
  }
}

/**
 * Обёртка хендлера: ловит всё, что не поймали, сообщает и отдаёт 500 без
 * подробностей наружу. Внутренности ошибок пользователю не показываем.
 */
export function withReport(
  route: string,
  handler: (req: Request, ctx: never) => Promise<Response>,
): (req: Request, ctx: never) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      await reportError(error, { route, method: req.method });
      return new Response(JSON.stringify({ error: "internal", message: "Что-то пошло не так. Мы уже знаем." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
