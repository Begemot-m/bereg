/**
 * Склонение тем анкеты в творительный падеж — для строк вида «Помогаю с …».
 * Список запросов в анкете хранится в именительном («тревога», «отношения»),
 * а в карточке он попадает в предложение, и без падежа получалось «Помогаю с
 * тревога, отношения».
 *
 * Готовые темы (`TOPICS`) переведены руками — на них держится каталог. Свою
 * формулировку специалист может вписать любую, поэтому дальше работает
 * осторожное правило: понятное окончание склоняем, всё непонятное оставляем
 * как есть — лучше именительный падеж, чем выдуманное слово.
 */

const INSTRUMENTAL: Record<string, string> = {
  "тревога": "тревогой",
  "выгорание": "выгоранием",
  "отношения": "отношениями",
  "самооценка": "самооценкой",
  "травма": "травмой",
  "утрата": "утратой",
  "стресс": "стрессом",
  "сон": "сном",
  "прокрастинация": "прокрастинацией",
  "одиночество": "одиночеством",
  "депрессия": "депрессией",
  "панические атаки": "паническими атаками",
  "границы": "границами",
  "эмоции": "эмоциями",
  "работа и карьера": "работой и карьерой",
  "семья": "семьёй",
  "родители": "родителями",
  "дети": "детьми",
  "расставание": "расставанием",
  "деньги": "деньгами",
  "зависимости": "зависимостями",
  "пищевое поведение": "пищевым поведением",
  "здоровье": "здоровьем",
  "поиск себя": "поиском себя",
  "сексуальность": "сексуальностью",
  "переезд": "переездом",
};

const HUSH = /[жшчщц]$/;

/** Одно слово в творительный падеж — только там, где правило однозначно. */
function wordToInstrumental(word: string): string | null {
  if (word.length < 4) return null;
  const stem = word.slice(0, -1);
  const last = word.slice(-1);
  if (/(ость|есть)$/.test(word)) return `${stem}ью`;
  if (last === "а") return HUSH.test(stem) ? `${stem}ей` : `${stem}ой`;
  if (last === "я") return `${stem}ей`;
  if (word.endsWith("ие") || word.endsWith("ье")) return `${stem}м`;
  if (last === "о" || last === "е") return `${stem}ом`;
  if (last === "и" || last === "ы") return `${stem}ами`;
  if (/[бвгдзклмнпрстфх]$/.test(word)) return `${word}ом`;
  return null;
}

/** Тема анкеты в творительном падеже: «тревога» → «тревогой». */
export function topicInstrumental(topic: string): string {
  const value = topic.trim();
  if (!value) return value;
  const known = INSTRUMENTAL[value.toLowerCase()];
  if (known) return known;
  // Составную формулировку не трогаем: угадать связь слов в ней нельзя.
  if (/\s/.test(value)) return value;
  // Аббревиатуру («СДВГ», «ПТСР») склонять нечем — она и в предложении стоит
  // в исходном виде.
  if (value === value.toUpperCase()) return value;
  const declined = wordToInstrumental(value.toLowerCase());
  if (!declined) return value;
  // Регистр первой буквы — как ввёл специалист.
  return value[0] === value[0].toUpperCase() ? declined[0].toUpperCase() + declined.slice(1) : declined;
}

/** Язык в предложный падеж: «русский» → «консультирует на русском». */
export function languagePrepositional(language: string): string {
  const value = language.trim().toLowerCase();
  if (/(ий|ый|ой)$/.test(value)) return `${value.slice(0, -2)}ом`;
  return value;
}

/** «7 лет», «2 года», «1 год» — год рядом с числом. */
export function yearsWord(count: number): string {
  const value = Math.abs(Math.round(count));
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "лет";
  const last = value % 10;
  if (last === 1) return "год";
  if (last >= 2 && last <= 4) return "года";
  return "лет";
}

/**
 * Перечисление тем для строки «Помогаю с …». Пустой список — нейтральная
 * формулировка: карточка не должна обрываться на предлоге.
 */
export function helpsLine(topics: string[] | undefined, limit = 3): string {
  const list = (topics ?? []).map((topic) => topic.trim()).filter(Boolean).slice(0, limit);
  if (!list.length) return "разными запросами";
  return list.map(topicInstrumental).join(", ");
}
