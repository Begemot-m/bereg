// Серверные переменные окружения. Бросаем понятную ошибку, если чего-то нет.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  get telegramBotToken() {
    return required("TELEGRAM_BOT_TOKEN");
  },
  initDataMaxAgeSeconds: Number(process.env.INITDATA_MAX_AGE_SECONDS ?? 86400),
};
