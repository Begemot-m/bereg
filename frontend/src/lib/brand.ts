// Название платформы — меняется в одну строку.
export const APP_NAME = "Хроника";
/** Винительный падеж: «Добро пожаловать в Хронику», а не «в Хроника». */
export const APP_NAME_ACC = "Хронику";
export const CENTER = "Амур и Психея";
export const CENTER_SITE = "murpsy.ru";
export const CENTER_URL = "https://murpsy.ru";
export const TAGLINE = "Психологическая поддержка на каждый день";

// Автор платформы: в кабинете это единственный живой контакт, поэтому ник —
// кликабельный, а не подпись.
export const AUTHOR_TG = "@mmgorba";
export const AUTHOR_TG_URL = "https://t.me/mmgorba";

// Боевой адрес. Ссылки-приглашения уходят живым людям, поэтому строятся от
// него, а не от текущего origin: из демо на Pages иначе уедет демо-ссылка.
export const PROD_URL = "https://chronika.space/";
/** Адрес платформы без схемы — им подписаны афиши и картинки. */
export const APP_SITE = "chronika.space";

// Мини-приложение живёт в боте, поэтому приглашения ведут не на сайт, а в
// Telegram: startapp открывает приложение сразу и передаёт метку страницы.
// Бот один и тот же везде, включая демо: приглашение из демо-сборки отправляют
// настоящему человеку, и вести его в витрину @murpsybot значит потерять клиента.
export const BOT_NAME = "chronikaspace_bot";

/** Ссылка, открывающая мини-приложение на нужном экране. */
export function botDeepLink(payload: string): string {
  return `https://t.me/${BOT_NAME}?startapp=${payload}`;
}

/**
 * Ссылка через чат бота: Telegram присылает метку в `/start <payload>`, бот
 * отвечает кнопкой, открывающей приложение с ней же. Нужна там, где важно
 * сначала поздороваться в чате.
 *
 * Приглашения на запись ходят не так, а через `botDeepLink`: у бота настроено
 * главное мини-приложение (`getMe` → `has_main_web_app`), и `startapp`
 * открывает нужный экран сразу, без чата и нажатия «Start».
 */
export function botStartLink(payload: string): string {
  return `https://t.me/${BOT_NAME}?start=${payload}`;
}
