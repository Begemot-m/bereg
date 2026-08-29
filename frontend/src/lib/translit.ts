/**
 * Латиница для ссылок. Telegram пускает в `startapp` только `A-Za-z0-9_-`,
 * поэтому кириллическое имя в метке ссылки превращается в слаг: «Анна
 * Петрова» → `anna-petrova`. Цифры из слага выкидываем — по хвосту из цифр
 * ссылка разбирается обратно в id специалиста.
 */
const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function translit(text: string): string {
  return text.toLowerCase().split("").map((ch) => MAP[ch] ?? ch).join("");
}

/** Имя и фамилия латиницей через дефис. Пусто — если писать нечего. */
export function nameSlug(name: string | null | undefined, maxWords = 2): string {
  if (!name) return "";
  return translit(name)
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, maxWords)
    .join("-")
    .slice(0, 32)
    .replace(/-+$/, "");
}
