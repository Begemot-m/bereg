import type { IconName } from "@/components/icons";

export type RuleId = "cancel" | "contact";
/** Правило анкеты: выбранная формулировка и показывать ли её клиенту. */
export type ProfileRule = { text: string; shown: boolean };
export type ProfileRules = Record<RuleId, ProfileRule>;

export const RULE_PRESETS: { id: RuleId; title: string; hint: string; icon: IconName; tone: string; placeholder: string; options: string[] }[] = [
  {
    id: "cancel",
    title: "Отмена и перенос",
    hint: "За сколько можно отменить встречу без оплаты",
    icon: "clock",
    tone: "amber",
    placeholder: "Напр.: Отмена без оплаты не позднее чем за 12 часов. Позже — оплачивается половина стоимости, один перенос в месяц бесплатно.",
    options: [
      "Бесплатно за 24 часа до встречи. Позже — сессия считается состоявшейся.",
      "Бесплатно за 48 часов до встречи. Позже — оплачивается половина стоимости.",
      "Перенести встречу можно в любой момент, если предупредить до её начала.",
      "Отмена без оплаты за неделю. Ближе к дате перенос по договорённости.",
    ],
  },
  {
    id: "contact",
    title: "Связь между сессиями",
    hint: "",
    icon: "note",
    tone: "purple",
    placeholder: "Напр.: Пишу и отвечаю только по организационным вопросам, содержательное — на встрече.",
    options: [
      "Короткие сообщения по договорённости, ответ в рабочее время. Разбор вопросов — на встрече.",
      "Между встречами не переписываемся: всё важное разбираем на сессии.",
      "Можно писать в любое время — отвечаю в течение дня.",
      "Связь только по организационным вопросам: перенос, оплата, время.",
    ],
  },
];

/** Готовые формулировки, которые редактор предлагает первыми. */
export const DEFAULT_RULES: ProfileRules = {
  cancel: { text: RULE_PRESETS[0].options[0], shown: true },
  contact: { text: RULE_PRESETS[1].options[0], shown: true },
};

/** Анкета начинается пустой: формулировку правила выбирает сам специалист. */
export const EMPTY_RULES: ProfileRules = {
  cancel: { text: "", shown: true },
  contact: { text: "", shown: true },
};

/** Правила из хранилища могли не сохраниться или прийти в старом виде. */
export function normalizeRules(raw: unknown): ProfileRules {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<RuleId, Partial<ProfileRule>>>;
  const one = (id: RuleId): ProfileRule => {
    const value = source[id];
    return {
      text: typeof value?.text === "string" ? value.text : "",
      shown: typeof value?.shown === "boolean" ? value.shown : true,
    };
  };
  return { cancel: one("cancel"), contact: one("contact") };
}

/** Оба правила сформулированы — шаг «Правила» в анкете закрыт. */
export function rulesFilled(rules: unknown): boolean {
  const normalized = normalizeRules(rules);
  return RULE_PRESETS.every((preset) => normalized[preset.id].text.trim().length > 0);
}

export type PublicRule = { id: RuleId; title: string; text: string; icon: IconName; tone: string };

/** Что из правил уходит в карточку каталога — только отмеченные галочкой. */
export function publicRules(rules: unknown): PublicRule[] {
  const normalized = normalizeRules(rules);
  return RULE_PRESETS.filter((preset) => normalized[preset.id].shown && normalized[preset.id].text.trim()).map((preset) => ({
    id: preset.id,
    title: preset.title,
    text: normalized[preset.id].text,
    icon: preset.icon,
    tone: preset.tone,
  }));
}
