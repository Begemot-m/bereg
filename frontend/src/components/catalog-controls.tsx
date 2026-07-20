"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { Button, Input } from "@/components/ui";
import { select, success, tap } from "@/lib/haptics";
import { EMPTY_FILTERS, EXPERIENCE_OPTIONS, LANGUAGES, METHODS, TOPICS, type CatalogFilters, type CatalogPrefs, type Gender, type TimeOfDay } from "@/lib/catalog";

const BUDGETS = [2500, 3500, 4500, 5500] as const;
const TIME_LABEL: Record<TimeOfDay, string> = { morning: "Утро", day: "День", evening: "Вечер" };

function ToggleChip({ active, children, onClick, className = "" }: { active: boolean; children: React.ReactNode; onClick: () => void; className?: string }) {
  return <button type="button" onClick={() => { select(); onClick(); }} className={`rounded-[13px] px-3 py-2 text-[12px] font-black transition-transform active:scale-95 stroke ${className}`} style={active ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff" }}>{children}</button>;
}

function toggleValue<T>(list: T[], value: T, limit?: number): T[] {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (limit && list.length >= limit) return [...list.slice(1), value];
  return [...list, value];
}

export function CatalogSurvey({ open, initial, onClose, onDone, onViewAll }: { open: boolean; initial: CatalogPrefs; onClose: () => void; onDone: (prefs: CatalogPrefs) => void; onViewAll: () => void }) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState(initial);
  useEffect(() => { if (open) { setPrefs(initial); setStep(0); } }, [open, initial]);
  const total = 7;
  const next = () => { select(); setStep((value) => Math.min(total - 1, value + 1)); };
  const prev = () => { tap(); setStep((value) => Math.max(0, value - 1)); };
  const finish = () => { success(); onDone(prefs); };

  return (
    <AnimatePresence>
      {open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(32,28,24,.46)] p-3 backdrop-blur-[2px] @md:items-center" onClick={onClose}>
        <motion.div initial={{ y: 34, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 34, opacity: 0 }} transition={{ type: "spring", stiffness: 410, damping: 32 }} onClick={(event) => event.stopPropagation()} className="chunk flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden bg-[#fffdf7]">
          <div className="flex items-center justify-between px-5 pt-4"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-[var(--muted)]">Настройка подборки</p><p className="mt-0.5 text-[13px] font-black">{step === 0 ? "Около минуты" : step === total - 1 ? "Готово" : `Шаг ${step} из ${total - 2}`}</p></div><button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[15px] font-black stroke" aria-label="Закрыть">×</button></div>
          <div className="px-5 pt-3"><div className="flex justify-center gap-1.5">{Array.from({ length: total }, (_, index) => <span key={index} className="h-2 rounded-full transition-all" style={{ width: index === step ? 20 : 8, background: index === step ? "var(--ink)" : "var(--edge-neutral)" }} />)}</div></div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <motion.div key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .22 }}>
              {step === 0 && <IntroStep />}
              {step === 1 && <TopicsStep prefs={prefs} setPrefs={setPrefs} />}
              {step === 2 && <FormatStep prefs={prefs} setPrefs={setPrefs} />}
              {step === 3 && <BudgetStep prefs={prefs} setPrefs={setPrefs} />}
              {step === 4 && <TimeStep prefs={prefs} setPrefs={setPrefs} />}
              {step === 5 && <PreferencesStep prefs={prefs} setPrefs={setPrefs} />}
              {step === 6 && <ResultStep />}
            </motion.div>
          </div>

          <div className="border-t px-5 py-4" style={{ borderColor: "var(--edge-neutral)" }}>
            {step === 0 ? <div className="space-y-2"><Button className="w-full" onClick={next}>Настроить подборку</Button><button onClick={onViewAll} className="w-full py-1 text-[12px] font-extrabold text-[var(--muted)]">Смотреть всех</button></div> : step === total - 1 ? <Button className="w-full" onClick={finish}>Посмотреть 6 специалистов</Button> : <div className="flex gap-2"><Button variant="soft" onClick={prev}>Назад</Button><Button className="flex-1" onClick={next}>{step === 4 || step === 5 ? "Далее" : "Продолжить"}</Button></div>}
          </div>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  );
}

function StepFrame({ tone, icon, title, text, children }: { tone: string; icon: Parameters<typeof Icon>[0]["name"]; title: string; text: string; children?: React.ReactNode }) {
  return <div><div className="flex min-h-[118px] items-center justify-center rounded-[20px] stroke-lg" style={{ background: tone }}><div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#fffdf7] stroke"><Icon name={icon} width={31} weight="bold" /></div></div><h2 className="font-tight mt-4 text-[23px] font-black leading-[1.08]">{title}</h2><p className="mt-2 text-[13px] font-semibold leading-relaxed text-[var(--muted)]">{text}</p>{children && <div className="mt-4">{children}</div>}</div>;
}
function IntroStep() { return <StepFrame tone="var(--salmon-soft)" icon="compass" title="Найдём тех, с кем может сложиться" text="Несколько коротких ответов помогут не листать сотни анкет. Настройки можно изменить в любой момент." />; }
function TopicsStep({ prefs, setPrefs }: { prefs: CatalogPrefs; setPrefs: (prefs: CatalogPrefs) => void }) { return <StepFrame tone="var(--amber-soft)" icon="heart" title="С чем хочется поработать?" text="Выберите до трёх тем. Если пока сложно сформулировать — это нормально."><div className="flex flex-wrap gap-2">{TOPICS.map((topic) => <ToggleChip key={topic} active={prefs.topics.includes(topic)} onClick={() => setPrefs({ ...prefs, topics: toggleValue(prefs.topics, topic, 3) })}>{topic}</ToggleChip>)}<ToggleChip active={!prefs.topics.length} onClick={() => setPrefs({ ...prefs, topics: [] })}>Пока не знаю</ToggleChip></div></StepFrame>; }
function FormatStep({ prefs, setPrefs }: { prefs: CatalogPrefs; setPrefs: (prefs: CatalogPrefs) => void }) { return <StepFrame tone="var(--green-soft)" icon="video" title="Как удобно встречаться?" text="Формат можно поменять позже — сейчас выберите наиболее комфортный."><div className="grid grid-cols-3 gap-2">{(["online", "offline", "both"] as const).map((format) => <ToggleChip key={format} active={prefs.format === format} onClick={() => setPrefs({ ...prefs, format })}>{format === "online" ? "Онлайн" : format === "offline" ? "Очно" : "Оба"}</ToggleChip>)}</div>{prefs.format !== "online" && <Input className="mt-3" value={prefs.city} onChange={(event) => setPrefs({ ...prefs, city: event.target.value })} placeholder="Город для очных встреч" />}</StepFrame>; }
function BudgetStep({ prefs, setPrefs }: { prefs: CatalogPrefs; setPrefs: (prefs: CatalogPrefs) => void }) { return <StepFrame tone="var(--purple-soft)" icon="chart" title="Какой бюджет комфортен?" text="Цена указана за одну встречу. Мы не покажем более дорогих специалистов без пояснения."><div className="grid grid-cols-2 gap-2">{BUDGETS.map((budget) => <ToggleChip key={budget} active={prefs.budget === budget} onClick={() => setPrefs({ ...prefs, budget })}>до {budget.toLocaleString("ru-RU")} ₽</ToggleChip>)}<ToggleChip className="col-span-2" active={prefs.budget == null} onClick={() => setPrefs({ ...prefs, budget: null })}>Неважно</ToggleChip></div></StepFrame>; }
function TimeStep({ prefs, setPrefs }: { prefs: CatalogPrefs; setPrefs: (prefs: CatalogPrefs) => void }) { return <StepFrame tone="var(--coral-soft)" icon="clock" title="Когда удобно встречаться?" text="Шаг можно пропустить. В подборке приоритет получат совпадающие окна."><p className="mb-2 text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Дни</p><div className="grid grid-cols-2 gap-2"><ToggleChip active={prefs.days.includes("weekdays")} onClick={() => setPrefs({ ...prefs, days: toggleValue(prefs.days, "weekdays") })}>Будни</ToggleChip><ToggleChip active={prefs.days.includes("weekends")} onClick={() => setPrefs({ ...prefs, days: toggleValue(prefs.days, "weekends") })}>Выходные</ToggleChip></div><p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Время</p><div className="grid grid-cols-3 gap-2">{(["morning", "day", "evening"] as TimeOfDay[]).map((time) => <ToggleChip key={time} active={prefs.times.includes(time)} onClick={() => setPrefs({ ...prefs, times: toggleValue(prefs.times, time) })}>{TIME_LABEL[time]}</ToggleChip>)}</div></StepFrame>; }
function PreferencesStep({ prefs, setPrefs }: { prefs: CatalogPrefs; setPrefs: (prefs: CatalogPrefs) => void }) { return <StepFrame tone="var(--sky)" icon="user" title="Есть важные пожелания?" text="Всё здесь необязательно и не влияет на качество специалиста."><p className="mb-2 text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Пол специалиста</p><div className="grid grid-cols-3 gap-2">{(["any", "woman", "man"] as const).map((gender) => <ToggleChip key={gender} active={prefs.gender === gender} onClick={() => setPrefs({ ...prefs, gender })}>{gender === "any" ? "Неважно" : gender === "woman" ? "Женщина" : "Мужчина"}</ToggleChip>)}</div><p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Язык</p><div className="flex flex-wrap gap-2">{["any", ...LANGUAGES].map((language) => <ToggleChip key={language} active={prefs.language === language} onClick={() => setPrefs({ ...prefs, language })}>{language === "any" ? "Неважно" : language}</ToggleChip>)}</div><p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Опыт</p><div className="grid grid-cols-3 gap-2">{EXPERIENCE_OPTIONS.map((years) => <ToggleChip key={years} active={prefs.minYears === years} onClick={() => setPrefs({ ...prefs, minYears: years })}>{years ? `от ${years} лет` : "Неважно"}</ToggleChip>)}</div></StepFrame>; }
function ResultStep() { return <StepFrame tone="var(--green-soft)" icon="check" title="Нашли 6 подходящих специалистов" text="В подборке есть точные совпадения, специалисты с меньшим числом показов и один подходящий новичок. Рейтинг нельзя купить." />; }

export function CatalogFiltersSheet({ open, value, resultCount, onClose, onApply }: { open: boolean; value: CatalogFilters; resultCount: (filters: CatalogFilters) => number; onClose: () => void; onApply: (filters: CatalogFilters) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);
  const count = useMemo(() => resultCount(draft), [draft, resultCount]);
  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75] flex items-end justify-center bg-[rgba(32,28,24,.44)] p-3 backdrop-blur-[2px]" onClick={onClose}><motion.div initial={{ y: 42 }} animate={{ y: 0 }} exit={{ y: 42, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 34 }} onClick={(event) => event.stopPropagation()} className="chunk flex max-h-[91vh] w-full max-w-md flex-col overflow-hidden bg-[#fffdf7]"><div className="flex items-center justify-between px-5 py-4"><div><p className="font-tight text-[21px] font-black">Все фильтры</p><p className="text-[11px] font-bold text-[var(--muted)]">Покажем только подходящие анкеты</p></div><button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-black stroke" aria-label="Закрыть">×</button></div><div className="min-h-0 flex-1 space-y-5 overflow-y-auto border-y px-5 py-4" style={{ borderColor: "var(--edge-neutral)" }}><FilterSection title="Запросы"><div className="flex flex-wrap gap-2">{TOPICS.map((topic) => <ToggleChip key={topic} active={draft.topics.includes(topic)} onClick={() => setDraft({ ...draft, topics: toggleValue(draft.topics, topic) })}>{topic}</ToggleChip>)}</div></FilterSection><FilterSection title="Методы"><div className="flex flex-wrap gap-2">{METHODS.map((method) => <ToggleChip key={method} active={draft.methods.includes(method)} onClick={() => setDraft({ ...draft, methods: toggleValue(draft.methods, method) })}>{method}</ToggleChip>)}</div></FilterSection><FilterSection title="Цена за встречу"><div className="grid grid-cols-2 gap-2">{BUDGETS.map((budget) => <ToggleChip key={budget} active={draft.maxPrice === budget} onClick={() => setDraft({ ...draft, maxPrice: budget })}>до {budget.toLocaleString("ru-RU")} ₽</ToggleChip>)}<ToggleChip active={draft.maxPrice == null} onClick={() => setDraft({ ...draft, maxPrice: null })}>Неважно</ToggleChip></div></FilterSection><FilterSection title="Формат"><div className="grid grid-cols-3 gap-2">{(["any", "online", "offline"] as const).map((format) => <ToggleChip key={format} active={draft.format === format} onClick={() => setDraft({ ...draft, format })}>{format === "any" ? "Любой" : format === "online" ? "Онлайн" : "Очно"}</ToggleChip>)}</div>{draft.format === "offline" && <Input className="mt-2" placeholder="Город" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />}</FilterSection><FilterSection title="Специалист"><div className="grid grid-cols-3 gap-2">{(["any", "woman", "man"] as const).map((gender) => <ToggleChip key={gender} active={draft.gender === gender} onClick={() => setDraft({ ...draft, gender })}>{gender === "any" ? "Неважно" : gender === "woman" ? "Женщина" : "Мужчина"}</ToggleChip>)}</div><div className="mt-2 grid grid-cols-3 gap-2">{EXPERIENCE_OPTIONS.map((years) => <ToggleChip key={years} active={draft.minYears === years} onClick={() => setDraft({ ...draft, minYears: years })}>{years ? `от ${years} лет` : "Опыт любой"}</ToggleChip>)}</div></FilterSection><FilterSection title="Язык консультации"><div className="flex flex-wrap gap-2"><ToggleChip active={draft.language === "any"} onClick={() => setDraft({ ...draft, language: "any" })}>Неважно</ToggleChip>{LANGUAGES.map((language) => <ToggleChip key={language} active={draft.language === language} onClick={() => setDraft({ ...draft, language })}>{language}</ToggleChip>)}</div></FilterSection><FilterSection title="Дополнительно"><div className="grid grid-cols-2 gap-2"><ToggleChip active={draft.verifiedOnly} onClick={() => setDraft({ ...draft, verifiedOnly: !draft.verifiedOnly })}>Подтверждённые</ToggleChip><ToggleChip active={draft.thisWeek} onClick={() => setDraft({ ...draft, thisWeek: !draft.thisWeek })}>Окно на неделе</ToggleChip></div></FilterSection></div><div className="flex gap-2 px-5 py-4"><Button variant="soft" onClick={() => { tap(); setDraft(EMPTY_FILTERS); }}>Сбросить</Button><Button className="flex-1" onClick={() => { success(); onApply(draft); }}>Показать {count}</Button></div></motion.div></motion.div>}</AnimatePresence>;
}
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><p className="mb-2 text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted)]">{title}</p>{children}</section>; }
