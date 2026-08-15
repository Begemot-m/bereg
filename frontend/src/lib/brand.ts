// Название платформы — меняется в одну строку.
export const APP_NAME = "Хроника";
/** Винительный падеж: «Добро пожаловать в Хронику», а не «в Хроника». */
export const APP_NAME_ACC = "Хронику";
export const CENTER = "Амур и Психея";
export const CENTER_SITE = "murpsy.ru";
export const CENTER_URL = "https://murpsy.ru";
export const TAGLINE = "Психологическая поддержка на каждый день";

// Боевой адрес. Ссылки-приглашения уходят живым людям, поэтому строятся от
// него, а не от текущего origin: из демо на Pages иначе уедет демо-ссылка.
export const PROD_URL = "https://chronika.space/";

// Мини-приложение живёт в боте, поэтому приглашения ведут не на сайт, а в
// Telegram: startapp открывает приложение сразу и передаёт метку страницы.
// Боевой бот — @chronikaspace_bot; @murpsybot остался витриной демо, чтобы
// ссылки из демо-сборки не приводили живых людей в продакшен.
export const BOT_NAME = process.env.NEXT_PUBLIC_DEMO === "1" ? "murpsybot" : "chronikaspace_bot";

/** Ссылка, открывающая мини-приложение на нужном экране. */
export function botDeepLink(payload: string): string {
  return `https://t.me/${BOT_NAME}?startapp=${payload}`;
}

/**
 * Ссылка через чат бота: Telegram присылает метку в `/start <payload>`, бот
 * отвечает кнопкой, открывающей приложение с ней же.
 *
 * Приглашения ходят так, а не через `startapp`: тот открывает мини-приложение
 * сразу, но только если у бота настроено главное мини-приложение. Пока его нет,
 * ссылка `startapp` приводила человека в пустой чат, метка терялась, и он не
 * видел ни экрана приглашения, ни знакомства.
 */
export function botStartLink(payload: string): string {
  return `https://t.me/${BOT_NAME}?start=${payload}`;
}
