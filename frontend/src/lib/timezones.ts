// Регион и часовой пояс специалиста. Расписание платформа считает в своей зоне
// (lib/zone.ts), но клиенту важно понимать, где человек находится и по какому
// времени он живёт: половина специалистов теперь за пределами России.

export type TimezoneOption = { id: string; label: string };

/** Часто встречающиеся зоны: Россия, соседи, популярные страны релокации. */
export const TIMEZONES: TimezoneOption[] = [
  { id: "Europe/Kaliningrad", label: "Калининград" },
  { id: "Europe/Moscow", label: "Москва, Санкт-Петербург" },
  { id: "Europe/Samara", label: "Самара, Ижевск" },
  { id: "Asia/Yekaterinburg", label: "Екатеринбург, Пермь" },
  { id: "Asia/Omsk", label: "Омск" },
  { id: "Asia/Novosibirsk", label: "Новосибирск, Красноярск" },
  { id: "Asia/Irkutsk", label: "Иркутск" },
  { id: "Asia/Yakutsk", label: "Якутск" },
  { id: "Asia/Vladivostok", label: "Владивосток" },
  { id: "Asia/Kamchatka", label: "Камчатка" },
  { id: "Asia/Almaty", label: "Алматы, Астана" },
  { id: "Asia/Tashkent", label: "Ташкент" },
  { id: "Asia/Tbilisi", label: "Тбилиси" },
  { id: "Asia/Yerevan", label: "Ереван" },
  { id: "Asia/Baku", label: "Баку" },
  { id: "Asia/Dubai", label: "Дубай" },
  { id: "Asia/Bangkok", label: "Бангкок, Пхукет" },
  { id: "Asia/Jerusalem", label: "Тель-Авив" },
  { id: "Europe/Minsk", label: "Минск" },
  { id: "Europe/Kyiv", label: "Киев" },
  { id: "Europe/Riga", label: "Рига, Вильнюс, Таллин" },
  { id: "Europe/Warsaw", label: "Варшава" },
  { id: "Europe/Belgrade", label: "Белград, Будва" },
  { id: "Europe/Berlin", label: "Берлин, Прага, Мадрид" },
  { id: "Europe/London", label: "Лондон, Лиссабон" },
  { id: "America/New_York", label: "Нью-Йорк, Торонто" },
  { id: "America/Chicago", label: "Чикаго" },
  { id: "America/Los_Angeles", label: "Лос-Анджелес" },
  { id: "Asia/Nicosia", label: "Кипр" },
];

/** Часовой пояс устройства — разумное предложение по умолчанию. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/** Сдвиг зоны в человеческом виде: «UTC+3». Неизвестная зона — пустая строка. */
export function zoneOffset(timezone: string, at: Date = new Date()): string {
  if (!timezone) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "shortOffset" }).formatToParts(at);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    return name.replace("GMT", "UTC").replace(/^UTC$/, "UTC+0");
  } catch {
    return "";
  }
}

/** Название зоны для человека: «Москва, Санкт-Петербург» либо сам идентификатор. */
export function zoneName(timezone: string): string {
  if (!timezone) return "";
  return TIMEZONES.find((item) => item.id === timezone)?.label ?? timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
}

/** Подпись зоны целиком: «Москва, Санкт-Петербург · UTC+3». Для списка выбора. */
export function zoneLabel(timezone: string): string {
  if (!timezone) return "";
  return [zoneName(timezone), zoneOffset(timezone)].filter(Boolean).join(" · ");
}

/** Первый город подписи: «Москва» из «Москва, Санкт-Петербург». */
export function zoneCity(timezone: string): string {
  return zoneName(timezone).split(",")[0].trim();
}

/**
 * Короткая подпись для интерфейса: «Москва, UTC+3». Полная («Москва,
 * Санкт-Петербург · UTC+3») хороша в выпадающем списке, но в карточке и под
 * календарём занимает полторы строки ради одной цифры сдвига.
 */
export function zoneShort(timezone: string): string {
  if (!timezone) return "";
  return [zoneCity(timezone), zoneOffset(timezone)].filter(Boolean).join(", ");
}

/** Который час у человека в этой зоне — «14:30». */
export function timeInZone(timezone: string, at: Date = new Date()): string {
  if (!timezone) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  } catch {
    return "";
  }
}

/** Совпадают ли зоны по фактическому сдвигу — тогда про разницу молчим. */
export function sameOffset(a: string, b: string, at: Date = new Date()): boolean {
  if (!a || !b) return true;
  return zoneOffset(a, at) === zoneOffset(b, at);
}
