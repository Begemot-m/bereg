/**
 * Слияние частичной правки анкеты с тем, что уже лежит в базе.
 *
 * Колонки, по которым фильтрует каталог, живут отдельно от Json — но и те и
 * другие обновляются только если поле реально пришло в теле запроса. Иначе
 * второе устройство, сохранившее анкету целиком, откатывало бы правки первого.
 */

/** Поля-колонки: в Json их не кладём, они разложены по столбцам таблицы. */
export const PROFILE_COLUMNS = new Set([
  "name", "primaryMethod", "experienceYears", "sessionPrice",
  "sessionMinutes", "format", "status", "location",
]);

export type ProfileFields = {
  name?: string;
  primaryMethod?: string;
  experienceYears?: number;
  sessionPrice?: number;
  sessionMinutes?: number;
  format?: string;
  city?: string;
};

type Dict = Record<string, unknown>;

export function mergeProfilePatch(curData: Dict, body: Dict): { data: Dict; fields: ProfileFields } {
  const data: Dict = { ...curData };
  for (const [key, value] of Object.entries(body)) if (!PROFILE_COLUMNS.has(key)) data[key] = value;

  if (body.location !== undefined) {
    const curLocation = (curData.location as Dict | undefined) ?? {};
    data.location = { ...curLocation, ...((body.location ?? {}) as Dict) };
  }

  const fields: ProfileFields = {};
  if (body.name !== undefined) fields.name = String(body.name ?? "").trim();
  if (body.primaryMethod !== undefined) fields.primaryMethod = String(body.primaryMethod ?? "");
  if (body.experienceYears !== undefined) fields.experienceYears = Number(body.experienceYears ?? 0) || 0;
  if (body.sessionPrice !== undefined) fields.sessionPrice = Number(body.sessionPrice ?? 0) || 0;
  // Ноль и пустая строка — законное «ещё не заполнено»: подставлять за
  // специалиста цену, длительность или формат нельзя.
  if (body.sessionMinutes !== undefined) fields.sessionMinutes = Number(body.sessionMinutes ?? 0) || 0;
  if (body.format !== undefined) fields.format = String(body.format ?? "");
  if (body.location !== undefined) fields.city = String((data.location as { city?: string }).city ?? "");

  return { data, fields };
}
