"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Badge, Button, Input, Textarea } from "@/components/ui";
import { EXPERIENCE_OPTIONS, LANGUAGES, METHODS, METHOD_DESCRIPTIONS, TOPICS } from "@/lib/catalog";
import { select, success, tap } from "@/lib/haptics";
import { displayName, displayPhoto, getPsyProfile, savePsyProfile, tgUsername, useProfile, type PsyProfile } from "@/lib/profile";

const DRAFT_KEY = "bereg_psy_profile_draft_v2";
const tgLink = (handle: string) => `https://t.me/${handle.replace(/^@/, "")}`;

const EMPTY_PROFILE: PsyProfile = {
  name: "", approach: "", primaryMethod: "", methods: [], experienceYears: "", about: "", firstSession: "",
  education: [], topics: [], gender: "unspecified", languages: ["русский"], format: "online", sessionPrice: 3500,
  location: { city: "", district: "", metro: "", address: "", publicExactAddress: false },
  photo: null, photos: [], sessionMinutes: 50, tg: "", status: "review",
};

type StepId = "identity" | "topics" | "methods" | "format" | "conditions" | "experience" | "story" | "preview";
type StepDefinition = { id: StepId; title: string; short: string; icon: IconName; tone: string; filter: string; optional?: boolean };

const STEPS: StepDefinition[] = [
  { id: "identity", title: "Фото и основное", short: "Имя, фото, язык и связь", icon: "user", tone: "var(--purple-soft)", filter: "Фильтры «пол» и «язык», карточка в каталоге" },
  { id: "topics", title: "Запросы клиентов", short: "С чем вы работаете", icon: "heart", tone: "var(--salmon-soft)", filter: "Фильтр «запрос» — главный в подборе" },
  { id: "methods", title: "Методы работы", short: "Основной и дополнительные", icon: "therapy", tone: "var(--green-soft)", filter: "Фильтр «метод»" },
  { id: "format", title: "Формат и адрес", short: "Онлайн, очно и приватность", icon: "pin", tone: "var(--sky)", filter: "Фильтры «формат» и «город»" },
  { id: "conditions", title: "Условия встречи", short: "Цена и длительность", icon: "clock", tone: "var(--amber-soft)", filter: "Фильтр «бюджет» и сортировка по цене" },
  { id: "experience", title: "Опыт и образование", short: "Практика и квалификация", icon: "book", tone: "var(--green-soft)", filter: "Фильтр «опыт» и сортировка по стажу" },
  { id: "story", title: "О вас", short: "Подход и первая встреча", icon: "spark", tone: "var(--coral-soft)", filter: "Поиск по словам и страница профиля" },
  { id: "preview", title: "Предпросмотр", short: "Как профиль увидит клиент", icon: "check", tone: "var(--purple-soft)", filter: "Итоговая карточка в каталоге" },
];

export function ProfileEditor({ embedded = false, professional = true, roleControl }: { embedded?: boolean; professional?: boolean; roleControl?: ReactNode }) {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const name = profile?.name || displayName();
  const photo = displayPhoto();

  return <>
    <div className={embedded ? "space-y-4" : "chunk p-4"}>
      <div className="flex items-center gap-3">
        <ProfilePhoto photo={photo} name={name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><p className="truncate text-[17px] font-extrabold">{name}</p>{professional && profile && (profile.status === "approved" ? <Badge tone="active">✓</Badge> : <Badge tone="planned">на проверке</Badge>)}</div>
          <p className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">{professional ? "Профиль психолога" : "Профиль клиента"}</p>
        </div>
      </div>
      {roleControl}
      {professional && <ProfileProgress profile={profile} onContinue={() => { tap(); setEditing(true); }} />}
      <div className="flex items-center gap-2">
        {professional && <button onClick={() => { tap(); setPreview(true); }} className="shrink-0 rounded-full px-3 py-2 text-[11px] font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)]">Как видят мой профиль</button>}
        <button onClick={() => { tap(); setEditing(true); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[11px] font-bold stroke"><Icon name="note" width={13} weight="regular" /> Редактировать профиль</button>
      </div>
    </div>

    <ProfileSheet open={editing} title="Профиль специалиста" onClose={() => setEditing(false)}>
      {professional ? <ProfileForm onDone={() => setEditing(false)} /> : <BasicProfileForm onDone={() => setEditing(false)} />}
    </ProfileSheet>
    <ProfileSheet open={preview} title="Так профиль видит клиент" onClose={() => setPreview(false)}>
      <PublicProfilePreview profile={profile} name={name} photo={photo} />
    </ProfileSheet>
  </>;
}

// Заполненность анкеты + подсказка, зачем её доводить до конца.
function ProfileProgress({ profile, onContinue }: { profile: PsyProfile | null; onContinue: () => void }) {
  const merged = mergeProfile(profile);
  const steps = STEPS.slice(0, -1);
  const done = steps.filter((item) => isComplete(item.id, merged)).length;
  const percent = Math.round((done / steps.length) * 100);
  const gap = steps.find((item) => !isComplete(item.id, merged));
  const full = percent === 100;

  return (
    <button onClick={onContinue} className="block w-full rounded-[18px] p-3.5 text-left transition-transform active:scale-[.99]" style={{ background: full ? "var(--green-soft)" : "var(--amber-soft)", border: `var(--bw-lg) solid var(--${full ? "green" : "amber"}-edge)` }}>
      <div className="flex items-end justify-between gap-3">
        <p className="text-[13px] font-black leading-tight">Профиль заполнен на {percent}%</p>
        <span className="tnum text-[15px] font-black">{done}/{steps.length}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
        <motion.div className="h-full rounded-full" style={{ background: full ? "var(--green)" : "var(--amber)" }} animate={{ width: `${percent}%` }} transition={{ type: "spring", stiffness: 220, damping: 24 }} />
      </div>
      <p className="mt-2 text-[10.5px] font-semibold leading-relaxed text-[var(--muted)]">
        {full
          ? "Все поля заполнены — вас находят по всем параметрам каталога: запрос, метод, формат, город, бюджет, опыт, язык."
          : `Каждое поле анкеты — это фильтр в каталоге. Чем полнее профиль, тем по большему числу параметров вас находят.${gap ? ` Осталось: ${gap.title.toLowerCase()}.` : ""}`}
      </p>
    </button>
  );
}

function ProfileSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[70] flex items-end justify-center @md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <button className="absolute inset-0 bg-[rgba(32,28,24,.34)]" onClick={onClose} aria-label="Закрыть" />
    <motion.section role="dialog" aria-modal="true" aria-label={title} initial={{ y: 32, opacity: .7 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: .3, ease: [.16, 1, .3, 1] }} className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[30px] bg-[var(--surface)] px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 stroke-lg @md:rounded-[30px] @md:p-6">
      <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-4 bg-[var(--surface)] pb-2"><h2 className="font-tight text-xl font-extrabold">{title}</h2><button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full stroke" aria-label="Закрыть">×</button></div>
      {children}
    </motion.section>
  </motion.div>}</AnimatePresence>;
}

function PublicProfilePreview({ profile, name, photo }: { profile: PsyProfile | null; name: string; photo: string | null }) {
  const methods = profile?.methods?.length ? profile.methods : profile?.primaryMethod ? [profile.primaryMethod] : [];
  const location = publicLocation(profile);
  const format = formatLabel(profile?.format ?? "online");
  return <article className="space-y-4">
    <div className="chunk overflow-hidden bg-white">
      <div className="p-4" style={{ background: "var(--purple-soft)" }}>
        <div className="flex items-center gap-3"><ProfilePhoto photo={photo} name={name} size="lg" /><div className="min-w-0"><div className="flex items-center gap-1.5"><h3 className="font-tight text-[22px] font-extrabold leading-tight">{name}</h3><Icon name="check" width={17} weight="fill" color="var(--green-edge)" /></div><p className="mt-1 text-[13px] font-bold text-[var(--muted)]">{[profile?.primaryMethod, profile?.experienceYears ? `${profile.experienceYears} ${yearsLabel(profile.experienceYears)} практики` : ""].filter(Boolean).join(" · ") || "Психолог платформы"}</p></div></div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        <PreviewStat label="Стоимость" value={`${(profile?.sessionPrice ?? 3500).toLocaleString("ru-RU")} ₽`} />
        <PreviewStat label="Длительность" value={`${profile?.sessionMinutes ?? 50} мин`} />
        <PreviewStat label="Формат" value={format} />
      </div>
    </div>

    {location && <section className="chunk p-4"><SectionTitle icon="pin" title="Формат и место" /><p className="text-[13px] font-bold">{location}</p>{profile?.format !== "online" && profile?.location.address && !profile.location.publicExactAddress && <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Точный адрес клиент получит после подтверждения очной встречи.</p>}</section>}
    {(profile?.languages?.length ?? 0) > 0 && <section><p className="mb-2 text-[11px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Языки консультации</p><div className="flex flex-wrap gap-1.5">{profile!.languages.map((language) => <Tag key={language}>{language}</Tag>)}</div></section>}
    {(profile?.topics?.length ?? 0) > 0 && <section><p className="mb-2 text-[11px] font-black uppercase tracking-[.08em] text-[var(--muted)]">С чем можно обратиться</p><div className="flex flex-wrap gap-1.5">{profile!.topics.map((topic) => <Tag key={topic}>{topic}</Tag>)}</div></section>}
    {methods.length > 0 && <section className="chunk space-y-2 p-4"><SectionTitle icon="therapy" title="Как я работаю" />{methods.map((method) => <div key={method} className="rounded-[15px] bg-[var(--surface-2)] p-3 stroke"><p className="text-[13px] font-black">{method}</p><p className="mt-1 text-[11px] font-semibold leading-relaxed text-[var(--muted)]">{METHOD_DESCRIPTIONS[method] ?? "Метод подбирается под запрос и задачи клиента."}</p></div>)}</section>}
    {profile?.about ? <section className="chunk p-4"><SectionTitle icon="spark" title="О специалисте" /><p className="text-[14px] leading-relaxed">{profile.about}</p></section> : <PreviewEmpty text="Добавьте рассказ о себе — он появится здесь." />}
    {profile?.firstSession && <section className="chunk p-4"><SectionTitle icon="compass" title="Как проходит первая встреча" /><p className="text-[14px] leading-relaxed">{profile.firstSession}</p></section>}
    {(profile?.education?.length ?? 0) > 0 && <section className="chunk p-4"><SectionTitle icon="book" title="Образование" /><ul className="space-y-2">{profile!.education.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-[13px]"><Icon name="check" width={16} className="mt-0.5 shrink-0" />{item}</li>)}</ul></section>}
    {profile?.tg ? <a href={tgLink(profile.tg)} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] py-3 text-[14px] font-black text-white transition-transform active:scale-[.98]"><Icon name="spark" width={16} weight="fill" /> Связаться в Telegram</a> : <div className="rounded-full bg-[var(--surface-2)] py-3 text-center text-[12px] font-semibold text-[var(--muted)] stroke">Добавьте Telegram — здесь появится кнопка связи</div>}
    <Button className="w-full" disabled>Записаться на сессию</Button>
    <p className="text-center text-[11px] text-[var(--muted-2)]">Предпросмотр публичной страницы специалиста.</p>
  </article>;
}

function PreviewStat({ label, value }: { label: string; value: string }) { return <div className="rounded-[14px] bg-[var(--surface-2)] p-2 text-center stroke"><p className="tnum truncate text-[12px] font-black">{value}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[.04em] text-[var(--muted)]">{label}</p></div>; }
function Tag({ children }: { children: ReactNode }) { return <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold stroke">{children}</span>; }
function SectionTitle({ icon, title }: { icon: IconName; title: string }) { return <div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--head-soft)] stroke"><Icon name={icon} width={14} weight="bold" /></span><p className="text-[12px] font-extrabold text-[var(--muted)]">{title}</p></div>; }
function PreviewEmpty({ text }: { text: string }) { return <div className="rounded-[18px] bg-[var(--surface-2)] p-4 text-[13px] font-semibold text-[var(--muted)] stroke">{text}</div>; }

function ProfileForm({ onDone }: { onDone: () => void }) {
  const [draft, setDraft] = useState<PsyProfile>(() => mergeProfile(getPsyProfile()));
  const [step, setStep] = useState<number>(() => {
    const profile = mergeProfile(getPsyProfile());
    const firstGap = STEPS.slice(0, -1).findIndex((item) => !isComplete(item.id, profile));
    return firstGap < 0 ? STEPS.length - 1 : firstGap;
  });
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) setDraft(mergeProfile(JSON.parse(stored) as PsyProfile));
    } catch { /* битый черновик не мешает открыть профиль */ }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* локальное хранилище может быть недоступно */ }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const completion = useMemo(() => STEPS.slice(0, -1).filter((item) => isComplete(item.id, draft)).length, [draft]);
  const percent = Math.round((completion / (STEPS.length - 1)) * 100);
  const update = (patch: Partial<PsyProfile>) => setDraft((current) => ({ ...current, ...patch }));
  const updateLocation = (patch: Partial<PsyProfile["location"]>) => setDraft((current) => ({ ...current, location: { ...current.location, ...patch } }));

  const openStep = (target: number) => { tap(); setError(""); setStep(target); };
  const next = () => {
    const message = validateStep(STEPS[step].id, draft);
    if (message) { setError(message); return; }
    select(); setError(""); setStep(Math.min(STEPS.length - 1, step + 1));
  };
  const back = () => { tap(); setError(""); setStep((current) => Math.max(0, current - 1)); };
  const save = () => {
    const firstInvalid = STEPS.slice(0, -1).findIndex((item) => validateStep(item.id, draft));
    if (firstInvalid >= 0) { setStep(firstInvalid); setError(validateStep(STEPS[firstInvalid].id, draft)); return; }
    savePsyProfile({ ...draft, primaryMethod: draft.primaryMethod, approach: draft.primaryMethod, photo: draft.photos[0] ?? null });
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    success(); onDone();
  };

  const current = STEPS[step ?? 0];
  const index = step ?? 0;

  return <div>
    {/* Прогресс + шаги: можно вернуться на любой пройденный и дозаполнить позже */}
    <div className="mb-4 overflow-hidden rounded-[22px] bg-white stroke-lg">
      <div className="h-1.5 bg-[var(--surface-2)]"><motion.div className="h-full bg-[var(--ink)]" animate={{ width: `${((index + 1) / STEPS.length) * 100}%` }} /></div>
      <div className="flex items-center gap-3 p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] stroke" style={{ background: current.tone }}><Icon name={current.icon} width={19} weight="bold" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.09em] text-[var(--muted)]">Шаг {index + 1} из {STEPS.length} · заполнено {percent}%</p>
          <h3 className="font-tight text-[19px] font-black leading-tight">{current.title}</h3>
        </div>
      </div>
      <div className="flex gap-1 border-t px-3 py-2.5" style={{ borderColor: "var(--edge-neutral)" }}>
        {STEPS.map((item, itemIndex) => {
          const done = itemIndex < STEPS.length - 1 && isComplete(item.id, draft);
          const active = itemIndex === index;
          return (
            <button
              key={item.id}
              onClick={() => openStep(itemIndex)}
              aria-label={`${itemIndex + 1}. ${item.title}`}
              aria-current={active}
              className="h-2.5 flex-1 rounded-full transition-colors"
              style={{ background: active ? "var(--ink)" : done ? "var(--green)" : "var(--surface-2)", border: `1.5px solid ${active ? "var(--ink)" : done ? "var(--green-edge)" : "var(--edge-neutral)"}` }}
            />
          );
        })}
      </div>
    </div>

    <AnimatePresence mode="wait" initial={false}><motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2, ease: [.16, 1, .3, 1] }}>
      {current.id === "identity" && <IdentityStep draft={draft} update={update} fileRef={fileRef} />}
      {current.id === "topics" && <TopicsStep draft={draft} update={update} />}
      {current.id === "methods" && <MethodsStep draft={draft} update={update} />}
      {current.id === "format" && <FormatStep draft={draft} update={update} updateLocation={updateLocation} />}
      {current.id === "conditions" && <ConditionsStep draft={draft} update={update} />}
      {current.id === "experience" && <ExperienceStep draft={draft} update={update} />}
      {current.id === "story" && <StoryStep draft={draft} update={update} />}
      {current.id === "preview" && <PublicProfilePreview profile={draft} name={draft.name || displayName()} photo={draft.photos[0] ?? displayPhoto()} />}
    </motion.div></AnimatePresence>

    <p className="mt-3 flex items-start gap-1.5 px-1 text-[10.5px] font-semibold leading-relaxed text-[var(--muted-2)]">
      <Icon name="compass" width={13} className="mt-[1px] shrink-0" /> {current.filter}
    </p>

    {error && <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-[14px] bg-[var(--salmon-soft)] px-3 py-2 text-[12px] font-bold stroke" style={{ borderColor: "var(--salmon-edge)" }}>{error}</motion.p>}

    <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t bg-[var(--surface)] px-4 pb-1 pt-3" style={{ borderColor: "var(--edge-neutral)" }}>
      <div className="flex gap-2">
        <Button variant="soft" onClick={back} disabled={index === 0}>Назад</Button>
        {index === STEPS.length - 1
          ? <Button className="flex-1" onClick={save}>Опубликовать профиль</Button>
          : <Button className="flex-1" onClick={next}>Продолжить</Button>}
      </div>
      <button onClick={() => { tap(); onDone(); }} className="mx-auto mt-2 block py-1 text-[12px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">
        Заполню позже — черновик сохранён
      </button>
    </div>
  </div>;
}

function IdentityStep({ draft, update, fileRef }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void; fileRef: React.RefObject<HTMLInputElement | null> }) {
  const onFile = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { update({ photos: [...draft.photos, String(reader.result)].slice(0, 3), photo: draft.photos[0] || String(reader.result) }); tap(); }; reader.readAsDataURL(file); };
  const setMain = (index: number) => { select(); const photos = [draft.photos[index], ...draft.photos.filter((_, itemIndex) => itemIndex !== index)]; update({ photos, photo: photos[0] ?? null }); };
  const removePhoto = (index: number) => { tap(); const photos = draft.photos.filter((_, itemIndex) => itemIndex !== index); update({ photos, photo: photos[0] ?? null }); };
  return <StepCard title="Сначала — то, что помогает узнать вас" hint="Первое фото станет крупным портретом в каталоге. Можно добавить до трёх.">
    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
    <div className="flex flex-wrap gap-2.5">{draft.photos.map((src, index) => <div key={`${src.slice(0, 20)}-${index}`} className="relative"><button onClick={() => setMain(index)} className="block h-[88px] w-[76px] overflow-hidden rounded-[17px] stroke" aria-label={index === 0 ? "Основное фото" : "Сделать основным"}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt="" className="h-full w-full object-cover" /></button><span className="absolute bottom-1 left-1 rounded-full bg-white px-1.5 py-0.5 text-[8px] font-black stroke">{index === 0 ? "основное" : `${index + 1}`}</span><button onClick={() => removePhoto(index)} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] font-black stroke" aria-label="Удалить фото">×</button></div>)}{draft.photos.length < 3 && <button onClick={() => fileRef.current?.click()} className="flex h-[88px] w-[76px] flex-col items-center justify-center gap-1 rounded-[17px] bg-white text-[10px] font-bold text-[var(--muted)]" style={{ border: "var(--bw) dashed var(--edge-neutral)" }}><Icon name="plus" width={18} />Фото</button>}</div>
    <Field label="Имя и фамилия"><Input value={draft.name} onChange={(event) => update({ name: event.target.value })} placeholder="Как к вам обращаться" /></Field>
    <Field label="Пол"><div className="grid grid-cols-3 gap-2"><Choice active={draft.gender === "woman"} onClick={() => update({ gender: "woman" })}>Женщина</Choice><Choice active={draft.gender === "man"} onClick={() => update({ gender: "man" })}>Мужчина</Choice><Choice active={draft.gender === "unspecified"} onClick={() => update({ gender: "unspecified" })}>Не указывать</Choice></div></Field>
    <Field label="Языки консультации"><div className="flex flex-wrap gap-2">{LANGUAGES.map((language) => <Choice key={language} active={draft.languages.includes(language)} onClick={() => update({ languages: toggle(draft.languages, language) })}>{language}</Choice>)}</div></Field>
    <Field label="Telegram для связи"><div className="flex items-center gap-2 rounded-[14px] bg-white px-3 stroke"><span className="font-black text-[var(--muted-2)]">@</span><input value={draft.tg} onChange={(event) => update({ tg: event.target.value.replace(/^@/, "") })} placeholder="username" className="w-full bg-transparent py-2.5 text-sm font-semibold outline-none" /></div></Field>
  </StepCard>;
}

function TopicsStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) { return <StepCard title="С чем к вам можно обратиться" hint="Выберите конкретные запросы. В карточке покажем два наиболее подходящих под выбор клиента."><div className="flex flex-wrap gap-2">{TOPICS.map((topic) => <Choice key={topic} active={draft.topics.includes(topic)} onClick={() => update({ topics: toggle(draft.topics, topic) })}>{topic}</Choice>)}</div><p className="text-[11px] font-semibold text-[var(--muted)]">Выбрано: {draft.topics.length}. Оптимально 3–7 запросов.</p></StepCard>; }

function MethodsStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) {
  const choosePrimary = (method: string) => update({ primaryMethod: method, approach: method, methods: draft.methods.includes(method) ? draft.methods : [method, ...draft.methods] });
  return <StepCard title="Как вы работаете" hint="Основной метод стоит рядом с именем. Дополнительные раскрываются на странице профиля."><Field label="Основной метод"><div className="flex flex-wrap gap-2">{METHODS.map((method) => <Choice key={method} active={draft.primaryMethod === method} onClick={() => choosePrimary(method)}>{method}</Choice>)}</div></Field><Field label="Дополнительные методы"><div className="space-y-2">{METHODS.map((method) => { const active = draft.methods.includes(method); return <button key={method} onClick={() => { const methods = toggle(draft.methods, method); update({ methods, primaryMethod: draft.primaryMethod === method && !methods.includes(method) ? "" : draft.primaryMethod, approach: draft.primaryMethod === method && !methods.includes(method) ? "" : draft.primaryMethod }); }} className="flex w-full items-start gap-3 rounded-[16px] bg-white p-3 text-left stroke"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full stroke" style={active ? { background: "var(--ink)", color: "white", borderColor: "var(--ink)" } : undefined}>{active ? "✓" : ""}</span><span><span className="block text-[13px] font-black">{method}</span><span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-[var(--muted)]">{METHOD_DESCRIPTIONS[method]}</span></span></button>; })}</div></Field></StepCard>;
}

function FormatStep({ draft, update, updateLocation }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void; updateLocation: (patch: Partial<PsyProfile["location"]>) => void }) {
  const offline = draft.format !== "online";
  return <StepCard title="Где проходят встречи" hint="Точный адрес скрыт по умолчанию. Вы сами решаете, показывать ли его всем посетителям профиля."><div className="grid grid-cols-3 gap-2"><Choice active={draft.format === "online"} onClick={() => update({ format: "online" })}>Онлайн</Choice><Choice active={draft.format === "offline"} onClick={() => update({ format: "offline" })}>Очно</Choice><Choice active={draft.format === "both"} onClick={() => update({ format: "both" })}>Оба</Choice></div>{offline && <div className="space-y-3 rounded-[18px] bg-white p-3 stroke"><div className="grid grid-cols-2 gap-2"><Field label="Город"><Input value={draft.location.city} onChange={(event) => updateLocation({ city: event.target.value })} placeholder="Москва" /></Field><Field label="Район"><Input value={draft.location.district} onChange={(event) => updateLocation({ district: event.target.value })} placeholder="Хамовники" /></Field></div><Field label="Метро или ориентир"><Input value={draft.location.metro} onChange={(event) => updateLocation({ metro: event.target.value })} placeholder="м. Фрунзенская" /></Field><Field label="Точный адрес"><Input value={draft.location.address} onChange={(event) => updateLocation({ address: event.target.value })} placeholder="Улица, дом, кабинет" /></Field><label className="flex cursor-pointer items-start gap-3 rounded-[15px] bg-[var(--amber-soft)] p-3 stroke" style={{ borderColor: "var(--amber-edge)" }}><button role="switch" aria-checked={draft.location.publicExactAddress} onClick={(event) => { event.preventDefault(); select(); updateLocation({ publicExactAddress: !draft.location.publicExactAddress }); }} className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full stroke" style={{ background: draft.location.publicExactAddress ? "var(--ink)" : "white" }}><motion.span animate={{ x: draft.location.publicExactAddress ? 20 : 2 }} className="absolute left-0 top-[2px] h-[18px] w-[18px] rounded-full bg-white stroke" /></button><span><span className="block text-[12px] font-black">Показывать точный адрес в профиле</span><span className="mt-0.5 block text-[10px] font-semibold leading-relaxed text-[var(--muted)]">Если выключено, клиент увидит только город, район и метро. Адрес откроется после подтверждения записи.</span></span></label></div>}</StepCard>;
}

function ConditionsStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) { return <StepCard title="Условия одной встречи" hint="Именно эти значения используются в фильтрах и на карточке каталога."><Field label="Стоимость, ₽"><Input type="number" min={0} step={100} value={draft.sessionPrice} onChange={(event) => update({ sessionPrice: Number(event.target.value) })} /></Field><Field label="Длительность"><div className="flex items-center gap-2.5"><button onClick={() => { select(); update({ sessionMinutes: Math.max(30, draft.sessionMinutes - 5) }); }} className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white text-[20px] font-black stroke" aria-label="Уменьшить">−</button><div className="flex h-11 min-w-[104px] items-center justify-center rounded-[13px] bg-[var(--head-soft)] px-3 stroke"><span className="tnum text-[16px] font-black">{draft.sessionMinutes} мин</span></div><button onClick={() => { select(); update({ sessionMinutes: Math.min(120, draft.sessionMinutes + 5) }); }} className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white text-[20px] font-black stroke" aria-label="Увеличить">+</button></div></Field><div className="rounded-[16px] bg-[var(--green-soft)] p-3 text-[11px] font-semibold leading-relaxed stroke" style={{ borderColor: "var(--green-edge)" }}>Размещение в каталоге платное, но цена размещения не влияет на рейтинг и порядок рекомендаций.</div></StepCard>; }

function ExperienceStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) {
  const setEducation = (index: number, value: string) => update({ education: draft.education.map((item, itemIndex) => itemIndex === index ? value : item) });
  return <StepCard title="Опыт и квалификация" hint="Клиент сможет отфильтровать по опыту и отдельно изучить образование."><Field label="Лет практики"><Input type="number" min={0} max={70} value={draft.experienceYears} onChange={(event) => update({ experienceYears: event.target.value })} placeholder="5" /><div className="mt-2 flex gap-2">{EXPERIENCE_OPTIONS.slice(1).map((years) => <Choice key={years} active={Number(draft.experienceYears) === years} onClick={() => update({ experienceYears: String(years) })}>от {years} лет</Choice>)}</div></Field><Field label="Образование и значимые программы"><div className="space-y-2">{draft.education.map((item, index) => <div key={index} className="flex gap-2"><Input value={item} onChange={(event) => setEducation(index, event.target.value)} placeholder="Учебное заведение, программа, год" /><button onClick={() => update({ education: draft.education.filter((_, itemIndex) => itemIndex !== index) })} className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-[12px] bg-white stroke" aria-label="Удалить">×</button></div>)}<button onClick={() => update({ education: [...draft.education, ""] })} className="flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-white py-2 text-[13px] font-bold stroke"><Icon name="plus" width={15} /> Добавить образование</button></div></Field></StepCard>;
}

function StoryStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) { return <StepCard title="Помогите почувствовать, каково с вами" hint="Без обещаний результата: спокойно расскажите о стиле работы и первой встрече."><Field label="О себе и подходе"><Textarea value={draft.about} onChange={(event) => update({ about: event.target.value })} placeholder="Как вы строите работу, что для вас важно в контакте…" rows={5} /><Counter value={draft.about} recommended="400–900 знаков" /></Field><Field label="Как проходит первая встреча"><Textarea value={draft.firstSession} onChange={(event) => update({ firstSession: event.target.value })} placeholder="Что обсудите, как определите запрос и следующий шаг…" rows={5} /><Counter value={draft.firstSession} recommended="250–600 знаков" /></Field></StepCard>; }

function StepCard({ title, hint, children }: { title: string; hint: string; children: ReactNode }) { return <section className="chunk space-y-4 bg-[var(--surface-2)] p-4"><div><h4 className="font-tight text-[18px] font-black">{title}</h4><p className="mt-1 text-[11px] font-semibold leading-relaxed text-[var(--muted)]">{hint}</p></div>{children}</section>; }
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button onClick={() => { select(); onClick(); }} className="rounded-full px-3 py-2 text-[11px] font-black transition-transform active:scale-95 stroke" style={active ? { background: "var(--ink)", color: "white", borderColor: "var(--ink)" } : { background: "white" }}>{active ? "✓ " : ""}{children}</button>; }
function Counter({ value, recommended }: { value: string; recommended: string }) { return <p className="mt-1 text-right text-[10px] font-semibold text-[var(--muted-2)]">{value.length} · рекомендуем {recommended}</p>; }

function BasicProfileForm({ onDone }: { onDone: () => void }) {
  const current = getPsyProfile();
  const [name, setName] = useState(current?.name || displayName());
  const [tg, setTg] = useState((current?.tg || tgUsername() || "").replace(/^@/, ""));
  return <div className="space-y-4"><Field label="Имя"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Как к вам обращаться" /></Field><Field label="Telegram"><div className="flex items-center gap-2 rounded-[14px] bg-white px-3 stroke"><span className="font-black text-[var(--muted-2)]">@</span><input value={tg} onChange={(event) => setTg(event.target.value.replace(/^@/, ""))} placeholder="username" className="w-full bg-transparent py-2.5 text-sm font-semibold outline-none" /></div></Field><Button className="w-full" onClick={() => { savePsyProfile({ name: name.trim(), tg: tg.trim() }); success(); onDone(); }}>Сохранить</Button></div>;
}

function ProfilePhoto({ photo, name, size }: { photo: string | null; name: string; size: "sm" | "lg" }) {
  const classes = size === "sm" ? "h-14 w-14 rounded-[16px] text-[20px]" : "h-[92px] w-[78px] rounded-[20px] text-[28px]";
  if (photo) return <div className={`${classes} shrink-0 overflow-hidden stroke`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo} alt="" className="h-full w-full object-cover" /></div>;
  return <div className={`${classes} flex shrink-0 items-center justify-center bg-[var(--head-soft)] font-black stroke`}>{name.trim().charAt(0).toUpperCase() || "П"}</div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[12px] font-extrabold text-[var(--muted)]">{label}</span>{children}</label>; }

function mergeProfile(profile: PsyProfile | null): PsyProfile {
  const merged = { ...EMPTY_PROFILE, ...(profile ?? {}), location: { ...EMPTY_PROFILE.location, ...(profile?.location ?? {}) } };
  merged.name ||= displayName();
  merged.tg ||= tgUsername();
  merged.primaryMethod ||= merged.approach;
  merged.approach = merged.primaryMethod;
  if (merged.primaryMethod && !merged.methods.includes(merged.primaryMethod)) merged.methods = [merged.primaryMethod, ...merged.methods];
  return merged;
}
function toggle(values: string[], value: string) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function formatLabel(format: PsyProfile["format"]) { return format === "online" ? "Онлайн" : format === "offline" ? "Очно" : "Онлайн и очно"; }
function yearsLabel(value: string) { const number = Math.abs(Number(value)) % 100; const tail = number % 10; if (number > 10 && number < 20) return "лет"; if (tail === 1) return "год"; if (tail >= 2 && tail <= 4) return "года"; return "лет"; }
function publicLocation(profile: PsyProfile | null) {
  if (!profile) return "";
  if (profile.format === "online") return "Онлайн — из любой точки";
  const place = [profile.location.city, profile.location.district, profile.location.metro].filter(Boolean).join(" · ");
  const exact = profile.location.publicExactAddress ? profile.location.address : "";
  return [profile.format === "both" ? "Онлайн и очно" : "Очно", place, exact].filter(Boolean).join(" · ");
}
function isComplete(step: StepId, profile: PsyProfile) { return !validateStep(step, profile); }
function validateStep(step: StepId, profile: PsyProfile): string {
  if (step === "identity") {
    if (!profile.name.trim()) return "Укажите имя и фамилию.";
    if (!profile.photos.length) return "Добавьте хотя бы одно фото для карточки каталога.";
    if (!profile.languages.length) return "Выберите хотя бы один язык консультации.";
  }
  if (step === "topics" && profile.topics.length < 2) return "Выберите хотя бы два запроса, с которыми вы работаете.";
  if (step === "methods") {
    if (!profile.primaryMethod) return "Выберите основной метод работы.";
    if (!profile.methods.length) return "Добавьте хотя бы один метод.";
  }
  if (step === "format" && profile.format !== "online") {
    if (!profile.location.city.trim()) return "Для очного приёма укажите город.";
    if (profile.location.publicExactAddress && !profile.location.address.trim()) return "Введите точный адрес или выключите его публичный показ.";
  }
  if (step === "conditions") {
    if (!Number.isFinite(profile.sessionPrice) || profile.sessionPrice <= 0) return "Укажите стоимость одной встречи.";
    if (profile.sessionMinutes < 30) return "Длительность встречи должна быть не меньше 30 минут.";
  }
  if (step === "experience") {
    if (profile.experienceYears === "" || Number(profile.experienceYears) < 0) return "Укажите опыт практики в годах.";
    if (!profile.education.some((item) => item.trim())) return "Добавьте хотя бы одно образование или значимую программу.";
  }
  if (step === "story") {
    if (profile.about.trim().length < 80) return "Расскажите о себе чуть подробнее — минимум 80 знаков.";
    if (profile.firstSession.trim().length < 50) return "Опишите первую встречу — минимум 50 знаков.";
  }
  return "";
}
