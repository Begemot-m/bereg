/**
 * Выполняется один раз при старте сервера — до первого запроса.
 * Здесь проверяем окружение, чтобы контейнер с недостающим секретом падал
 * сразу и деплой откатился, а не отдавал пользователям сломанные ответы.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEnv } = await import("@/lib/server/env");
  assertEnv();
}
