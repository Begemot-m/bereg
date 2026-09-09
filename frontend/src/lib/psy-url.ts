import { OWN_PROFILE_ID, type Psy } from "@/lib/catalog";
import { nameSlug } from "@/lib/translit";

/**
 * Адрес анкеты в каталоге: `/catalog/anna-petrova-42`. Имя нужно человеку и
 * поисковику, id — приложению: он берётся из хвоста, поэтому смена имени
 * старую ссылку не ломает.
 */
export function psySlug(name: string | null | undefined, id: number): string {
  return `${nameSlug(name) || "psiholog"}-${id}`;
}

export function psyIdFromSlug(slug: string): number {
  const tail = /(\d+)$/.exec(slug);
  return tail ? Number(tail[1]) : 0;
}

/**
 * Своя анкета живёт только в браузере (предпросмотр из кабинета), отдельной
 * страницы у неё нет — для неё остаётся прежний `?psy=`.
 */
export function psyPath(psy: Pick<Psy, "id" | "name">): string {
  if (!psy.id || psy.id === OWN_PROFILE_ID) return `/catalog?psy=${psy.id}`;
  return `/catalog/${psySlug(psy.name, psy.id)}`;
}
