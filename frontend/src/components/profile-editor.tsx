"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { ArrowGlyph } from "@/components/blocks";
import { VerificationPrompt } from "@/components/verification-prompt";
import { useVerification } from "@/lib/psy-verification";
import { Button, Disclosure, Input, Prose, Textarea } from "@/components/ui";
import { EXPERIENCE_OPTIONS, LANGUAGES, METHODS, TOPICS } from "@/lib/catalog";
import { select, success, tap } from "@/lib/haptics";
import { MEDIA_LIMITS, mb } from "@/lib/image";
import { PhotoCropper } from "@/components/photo-cropper";
import { CURRENCIES, currencySymbol, formatMoney, MIN_PRICE, toCurrency } from "@/lib/money";
import { deviceTimezone, TIMEZONES, zoneLabel } from "@/lib/timezones";
import { displayName, displayPhoto, getPsyProfile, hasRestrictedLink, INSTAGRAM_NOTE, normalizeLinkUrl, savePsyProfile, tgUsername, useProfile, LINK_META, SPECIALIST_TYPES, STYLE_OPTIONS, type LinkKind, type PsyProfile } from "@/lib/profile";
import { EMPTY_RULES, normalizeRules, publicRules, RULE_PRESETS, rulesFilled, type RuleId } from "@/lib/profile-rules";
import { helpsLine } from "@/lib/morph";

const DRAFT_KEY = "bereg_psy_profile_draft_v2";
const tgLink = (handle: string) => `https://t.me/${handle.replace(/^@/, "")}`;

/** Запросы в порядке показа: отмеченные звёздочкой впереди остальных. */
const orderedTopics = (profile: { topics: string[]; topTopics?: string[] }) => {
  const top = (profile.topTopics ?? []).filter((topic) => profile.topics.includes(topic)).slice(0, 3);
  return [...top.map((topic) => ({ topic, top: true })), ...profile.topics.filter((topic) => !top.includes(topic)).map((topic) => ({ topic, top: false }))];
};

const EMPTY_PROFILE: PsyProfile = {
  name: "", approach: "", primaryMethod: "", methods: [], experienceYears: "", about: "", firstSession: "",
  education: [], topics: [], topTopics: [], gender: "unspecified", languages: [], format: "", sessionPrice: 0, currency: "RUB",
  location: { city: "", district: "", metro: "", address: "", publicExactAddress: false, region: "" },
  timezone: "",
  photo: null, photos: [], sessionMinutes: 0, tg: "", specialistTypes: [], links: [], style: "", quote: "", avoids: [],
  showStats: false, rules: EMPTY_RULES, status: "review",
};

type StepId = "identity" | "topics" | "methods" | "format" | "conditions" | "experience" | "story" | "rules" | "preview";
type StepDefinition = { id: StepId; title: string; short: string; icon: IconName; tone: string; optional?: boolean };

const STEPS: StepDefinition[] = [
  { id: "identity", title: "Фото и основное", short: "Имя, фото, язык и связь", icon: "user", tone: "var(--purple-soft)" },
  { id: "topics", title: "Запросы клиентов", short: "С чем вы работаете", icon: "heart", tone: "var(--salmon-soft)" },
  { id: "methods", title: "Методы работы", short: "Основной и дополнительные", icon: "therapy", tone: "var(--green-soft)" },
  { id: "format", title: "Формат и адрес", short: "Онлайн, очно и приватность", icon: "pin", tone: "var(--sky)" },
  { id: "conditions", title: "Условия встречи", short: "Цена и длительность", icon: "clock", tone: "var(--amber-soft)" },
  { id: "experience", title: "Опыт и образование", short: "Практика и квалификация", icon: "book", tone: "var(--green-soft)" },
  { id: "story", title: "О вас", short: "Подход и первая встреча", icon: "spark", tone: "var(--coral-soft)" },
  { id: "rules", title: "Настройки и правила", short: "Статистика в анкете и правила работы", icon: "gear", tone: "var(--amber-soft)" },
  { id: "preview", title: "Предпросмотр", short: "Как профиль увидит клиент", icon: "check", tone: "var(--purple-soft)" },
];

export function ProfileEditor({ embedded = false, professional = true, roleControl }: { embedded?: boolean; professional?: boolean; roleControl?: ReactNode }) {
  const profile = useProfile();
  const router = useRouter();
  const verification = useVerification();
  const [editing, setEditing] = useState(false);
  const name = profile?.name || displayName();
  // Печать у имени — ровно та же, что видит клиент в каталоге: подтверждённый
  // профиль узнаётся с одного взгляда, без отдельной строки о статусе.
  const verified = professional && verification.data?.status === "approved";
  const photo = displayPhoto();
  const openEditor = () => {
    tap();
    if (professional) router.push("/cabinet/profile");
    else setEditing(true);
  };

  return <>
    <div className={embedded ? "space-y-4" : "chunk p-4"}>
      <div className="flex items-center gap-3">
        <ProfilePhoto photo={photo} name={name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[21px] font-extrabold leading-tight">
            <span className="truncate">{name}</span>
            {verified && <Icon name="seal" width={19} weight="fill" color="var(--green)" className="shrink-0" />}
          </p>
          <button onClick={openEditor} className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--muted)]"><Icon name="edit" width={12} weight="bold" color="currentColor" /> Редактировать профиль</button>
        </div>
      </div>
      {roleControl}
      {professional && <VerificationPrompt />}
      {professional && <ProfileProgress profile={profile} onContinue={openEditor} />}
      {professional && (profileCompletionPercent(profile) === 100
        ? <NextSteps />
        : <p className="px-1 text-[11px] font-semibold leading-snug text-[var(--muted)]">Заполненный профиль увидят ваши клиенты. Для размещения в каталоге пройдите верификацию.</p>)}
    </div>

    <ProfileSheet open={editing} title="Профиль специалиста" onClose={() => setEditing(false)}>
      <BasicProfileForm onDone={() => setEditing(false)} />
    </ProfileSheet>
  </>;
}

export function ProfessionalProfileEditor() {
  return <ProfileForm livePreview />;
}

// Статус проверки показывает VerificationPrompt под шапкой. Отдельный чип брал
// его из поля профиля, которое в демо всегда «на проверке», — и спорил с ним.

// Заполненность анкеты — компактный живой блок с иконкой и короткой подсказкой.
function ProfileProgress({ profile, onContinue }: { profile: PsyProfile | null; onContinue: () => void }) {
  const merged = mergeProfile(profile);
  const steps = STEPS.slice(0, -1);
  const done = steps.filter((item) => isComplete(item.id, merged)).length;
  const percent = Math.round((done / steps.length) * 100);
  const full = percent === 100;

  return (
    <button
      type="button"
      onClick={onContinue}
      data-tour="profile-progress"
      className="flex w-full items-center gap-3 rounded-[16px] bg-white p-3 text-left transition-transform active:scale-[0.99]"
    >
      <Icon name="user" width={38} weight="fill" color="var(--tiffany)" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black leading-tight">Профиль заполнен на <span className="tnum" style={{ color: "var(--tiffany-edge)" }}>{percent}%</span></p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white" style={{ border: "1px solid var(--tiffany-edge)" }}>
          <motion.div className="h-full rounded-full" style={{ background: "var(--tiffany-edge)" }} animate={{ width: `${percent}%` }} transition={{ type: "spring", stiffness: 220, damping: 24 }} />
        </div>
        {full && <p className="mt-1 truncate text-[10.5px] font-semibold text-[var(--muted)]">Профиль готов — его увидят ваши клиенты</p>}
      </div>
      {/* Пустую анкету «заполняют», начатую — «редактируют»: кнопка «Заполнить»
          над заполненной наполовину полосой выглядела так, будто всё сотрут. */}
      <span className="btn shrink-0 px-4 py-2 text-[12px]">{percent > 0 ? "Правка" : "Заполнить"}</span>
    </button>
  );
}

const NEXT_STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "users", title: "Профиль увидят ваши клиенты", text: "Те, кого вы ведёте, откроют карточку и посмотрят условия, правила и как проходит первая встреча." },
  { icon: "calendar", title: "Заполните график и отправьте клиентам", text: "Так они сами видят свободные окна и записываются, не спрашивая у вас каждый раз." },
  { icon: "spark", title: "С PRO вы попадёте в каталог", text: "Анкету увидят все пользователи площадки — вас смогут найти новые клиенты." },
];

// Анкета заполнена — дальше человеку нужен не процент, а следующий шаг.
// Подсказка одноразовая: закрыл — больше не возвращается.
const NEXT_STEPS_KEY = "bereg_next_steps_hidden";

function NextSteps() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => { setHidden(localStorage.getItem(NEXT_STEPS_KEY) === "1"); }, []);
  const close = () => { tap(); localStorage.setItem(NEXT_STEPS_KEY, "1"); setHidden(true); };
  if (hidden) return null;

  return (
    <div className="rounded-[16px] p-4" style={{ background: "var(--tiffany-soft)" }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] font-black leading-tight">Что делать дальше?</p>
        <button onClick={close} aria-label="Скрыть подсказку" className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 transition-transform active:scale-90">
          <Icon name="close" width={13} weight="bold" color="var(--ink)" />
        </button>
      </div>
      <div className="mt-3 space-y-2.5">
        {NEXT_STEPS.map((item) => (
          <div key={item.title} className="flex items-start gap-2.5">
            <span className="ico ico-white h-8 w-8 shrink-0"><Icon name={item.icon} width={15} weight="bold" color="var(--tiffany-edge)" /></span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-black leading-tight">{item.title}</p>
              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-[var(--ink)] opacity-70">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
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
    <motion.section role="dialog" aria-modal="true" aria-label={title} initial={{ y: 32, opacity: .7 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: .3, ease: [.16, 1, .3, 1] }} className="relative max-h-[min(92dvh,calc(100dvh-var(--top-pad)))] w-full max-w-xl overflow-y-auto rounded-t-[27px] bg-[var(--surface)] px-4 pb-[calc(var(--safe-bottom)+20px)] pt-4 stroke-lg @md:rounded-[27px] @md:p-6">
      <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-4 bg-[var(--surface)] pb-2"><h2 className="font-tight text-xl font-extrabold">{title}</h2><button onClick={onClose} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-black stroke" aria-label="Закрыть"><span className="text-[14px] leading-none">×</span>Закрыть</button></div>
      {children}
    </motion.section>
  </motion.div>}</AnimatePresence>;
}

function PublicProfilePreview({ profile, name, photo }: { profile: PsyProfile | null; name: string; photo: string | null }) {
  const methods = profile?.methods?.length ? profile.methods : profile?.primaryMethod ? [profile.primaryMethod] : [];
  const location = publicLocation(profile);
  const format = formatLabel(profile?.format ?? "online");
  return <article className="space-y-4">
    <CatalogThumb profile={profile} name={name} photo={photo} />
    <div className="chunk overflow-hidden bg-white">
      <div className="p-4" style={{ background: "var(--purple-soft)" }}>
        <div className="flex items-center gap-3"><ProfilePhoto photo={photo} name={name} size="lg" /><div className="min-w-0"><div className="flex items-center gap-1.5"><h3 className="font-tight text-[22px] font-extrabold leading-tight">{name}</h3><Icon name="check" width={17} weight="fill" color="var(--green-edge)" /></div><p className="mt-1 text-[13px] font-bold text-[var(--muted)]">{[profile?.specialistType, profile?.primaryMethod, profile?.experienceYears ? `${profile.experienceYears} ${yearsLabel(profile.experienceYears)} практики` : ""].filter(Boolean).join(" · ") || "Психолог платформы"}</p>{profile?.style && <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-black stroke"><Icon name="spark" width={11} weight="fill" /> стиль: {profile.style}</span>}</div></div>
        {(profile?.links?.filter((l) => normalizeLinkUrl(l.kind, l.url)).length ?? 0) > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{profile!.links.map((link, i) => ({ ...link, href: normalizeLinkUrl(link.kind, link.url), i })).filter((l) => l.href).map((link) => <a key={link.i} href={link.href!} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-white stroke" title={LINK_META[link.kind].label}><Icon name={LINK_META[link.kind].icon} width={15} weight="bold" /></a>)}</div>}
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        <PreviewStat label="Стоимость" value={profile?.sessionPrice ? formatMoney(profile.sessionPrice, toCurrency(profile.currency)) : "—"} />
        <PreviewStat label="Длительность" value={profile?.sessionMinutes ? `${profile.sessionMinutes} мин` : "—"} />
        <PreviewStat label="Формат" value={format} />
      </div>
    </div>

    {location && <section className="chunk p-4"><SectionTitle icon="pin" title="Формат и место" /><p className="text-[13px] font-bold">{location}</p>{(profile?.location.region?.trim() || profile?.timezone) && <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{[profile?.location.region?.trim(), profile?.timezone ? zoneLabel(profile.timezone) : ""].filter(Boolean).join(" · ")}</p>}{profile?.format !== "online" && profile?.location.address && !profile.location.publicExactAddress && <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Точный адрес клиент получит после подтверждения очной встречи.</p>}</section>}
    {(profile?.languages?.length ?? 0) > 0 && <section><p className="mb-2 text-[11px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Языки консультации</p><div className="flex flex-wrap gap-1.5">{profile!.languages.map((language) => <Tag key={language}>{language}</Tag>)}</div></section>}
    {(profile?.topics?.length ?? 0) > 0 && <section><p className="mb-2 text-[11px] font-black uppercase tracking-[.08em] text-[var(--muted)]">С чем можно обратиться</p><div className="flex flex-wrap gap-1.5">{orderedTopics(profile!).map(({ topic, top }) => <Tag key={topic}>{top ? <span className="inline-flex items-center gap-1"><Icon name="star" width={10} weight="fill" color="var(--tiffany-edge)" />{topic}</span> : topic}</Tag>)}</div></section>}
    {(profile?.avoids?.length ?? 0) > 0 && <section><p className="mb-2 text-[11px] font-black uppercase tracking-[.08em] text-[var(--muted)]">С чем не работает</p><div className="flex flex-wrap gap-1.5">{profile!.avoids.map((topic) => <span key={topic} className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[12px] font-bold text-[var(--muted)] stroke">{topic}</span>)}</div></section>}
    {methods.length > 0 && <section><p className="mb-2 text-[11px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Методы и подходы</p><div className="flex flex-wrap gap-1.5">{methods.map((method) => <Tag key={method}>{method === profile?.primaryMethod ? `★ ${method}` : method}</Tag>)}</div></section>}
    {profile?.about ? <section className="chunk p-4"><SectionTitle icon="spark" title="О специалисте" /><Prose text={profile.about} className="text-[14px] leading-relaxed" /></section> : <PreviewEmpty text="Добавьте рассказ о себе — он появится здесь." />}
    {profile?.firstSession && <section className="chunk p-4"><SectionTitle icon="compass" title="Как проходит первая встреча" /><Prose text={profile.firstSession} className="text-[14px] leading-relaxed" /></section>}
    {(profile?.education?.length ?? 0) > 0 && <section className="chunk p-4"><SectionTitle icon="book" title="Образование" /><ul className="space-y-2">{profile!.education.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-[13px]"><Icon name="check" width={16} className="mt-0.5 shrink-0" />{item}</li>)}</ul></section>}
    {publicRules(profile?.rules).length > 0 && <section className="chunk p-4"><SectionTitle icon="gear" title="Правила работы" /><div className="space-y-2.5">{publicRules(profile?.rules).map((rule) => <div key={rule.id} className="flex items-start gap-2.5"><span className="ico h-8 w-8 shrink-0" style={{ background: `var(--${rule.tone}-edge)` }}><Icon name={rule.icon} width={15} weight="bold" color="#fff" /></span><div><p className="text-[12.5px] font-black">{rule.title}</p><p className="mt-0.5 text-[11px] font-semibold leading-snug text-[var(--muted)]">{rule.text}</p></div></div>)}</div></section>}
    {profile?.tg ? <a href={tgLink(profile.tg)} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] py-3 text-[14px] font-black text-white transition-transform active:scale-[.98]"><Icon name="spark" width={16} weight="fill" /> Связаться в Telegram</a> : <div className="rounded-full bg-[var(--surface-2)] py-3 text-center text-[12px] font-semibold text-[var(--muted)] stroke">Добавьте Telegram — здесь появится кнопка связи</div>}
    <Button className="w-full" disabled>Записаться на сессию</Button>
    <p className="text-center text-[11px] text-[var(--muted-2)]">Предпросмотр публичной страницы специалиста.</p>
  </article>;
}

// Карточка-миниатюра повторяет представление специалиста в каталоге.
function CatalogThumb({ profile, name, photo }: { profile: PsyProfile | null; name: string; photo: string | null }) {
  const helps = helpsLine(profile?.topics);
  const price = profile?.sessionPrice ? formatMoney(profile.sessionPrice, toCurrency(profile.currency)) : "—";
  const minutes = profile?.sessionMinutes || "—";
  const format = formatLabel(profile?.format || "online");
  return (
    <div>
      <p className="mb-2 text-[10px] font-black uppercase tracking-[.07em] text-[var(--muted)]">Карточка в каталоге</p>
      <div className="overflow-hidden rounded-[22px] bg-white" style={{ border: "var(--bw-lg) solid var(--edge-neutral)", boxShadow: "0 16px 32px -22px rgba(32,28,24,.42)" }}>
        <div className="flex gap-3.5 p-4">
          <div className="relative flex h-[132px] w-[106px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] text-[30px] font-black" style={{ border: "var(--bw-lg) solid var(--tiffany-edge)", background: "var(--tiffany-soft)" }}>
            {photo ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo} alt="" className="h-full w-full object-cover" /></> : (name.trim().charAt(0).toUpperCase() || "П")}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-1.5">
              <h3 className="min-w-0 text-[17px] font-black leading-[1.06]">{name}</h3>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--green-soft)]" style={{ border: "1.5px solid var(--green-edge)" }}><Icon name="check" width={12} weight="fill" color="var(--green-edge)" /></span>
            </div>
            <p className="mt-1.5 text-[12.5px] font-bold leading-snug"><span className="text-[var(--muted)]">Помогаю с </span>{helps}</p>
            {profile?.quote && <p className="mt-2 border-l-2 pl-2.5 text-[11.5px] font-semibold italic leading-snug text-[var(--muted)]" style={{ borderColor: "var(--tiffany-edge)" }}>«{profile.quote}»</p>}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 border-t px-4 py-3" style={{ borderColor: "var(--edge-neutral)" }}>
          <div className="min-w-0">
            <p className="text-[15px] font-black leading-none">{price}<span className="text-[11px] font-bold text-[var(--muted)]"> / {minutes} мин</span></p>
            <p className="mt-1 flex items-center gap-1 text-[10px] font-black text-[var(--muted)]"><Icon name="calendar" width={11} weight="bold" /> {format}</p>
          </div>
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-[var(--ink)] px-4 py-2.5 text-[12px] font-black text-white">Посмотреть и записаться <ArrowGlyph /></span>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) { return <div className="rounded-[13px] bg-[var(--surface-2)] p-2 text-center stroke"><p className="tnum truncate text-[12px] font-black">{value}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[.04em] text-[var(--muted)]">{label}</p></div>; }
function Tag({ children }: { children: ReactNode }) { return <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold stroke">{children}</span>; }
function SectionTitle({ icon, title }: { icon: IconName; title: string }) { return <div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--head-soft)] stroke"><Icon name={icon} width={14} weight="bold" /></span><p className="text-[12px] font-extrabold text-[var(--muted)]">{title}</p></div>; }
function PreviewEmpty({ text }: { text: string }) { return <p className="t-sub px-1">{text}</p>; }

function ProfileForm({ livePreview = false }: { livePreview?: boolean }) {
  const flowSteps = livePreview ? STEPS.slice(0, -1) : STEPS;
  const stored = useProfile();
  const [draft, setDraft] = useState<PsyProfile>(() => mergeProfile(getPsyProfile()));
  const [step, setStep] = useState<number>(() => {
    const profile = mergeProfile(getPsyProfile());
    const firstGap = flowSteps.findIndex((item) => !isComplete(item.id, profile));
    return firstGap < 0 ? flowSteps.length - 1 : firstGap;
  });
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  // Пока пользователь ничего не менял, автосохранение молчит: иначе открытие
  // анкеты само записало бы в профиль значения по умолчанию.
  const touched = useRef(false);

  // Отдельного черновика в браузере больше нет: анкету ведёт сервер, а на
  // втором устройстве старый черновик возвращал в неё давно переписанные поля.
  useEffect(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* локальное хранилище может быть недоступно */ }
  }, []);

  // Пока человек ничего не менял, форма показывает то, что приехало из базы.
  useEffect(() => {
    if (touched.current || !stored) return;
    setDraft(mergeProfile(stored));
  }, [stored]);

  // Всё, что ввели, сохраняется само — кнопки «Сохранить» больше нет.
  // Статус проверки при этом не трогаем, иначе автосохранение молча снимало бы
  // пройденную модерацию.
  useEffect(() => {
    if (!touched.current) return;
    const timer = window.setTimeout(() => {
      savePsyProfile({ ...draft, approach: draft.primaryMethod, photo: draft.photos[0] ?? null, status: getPsyProfile()?.status ?? "review" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const completion = useMemo(() => STEPS.slice(0, -1).filter((item) => isComplete(item.id, draft)).length, [draft]);
  const percent = Math.round((completion / (STEPS.length - 1)) * 100);
  const update = (patch: Partial<PsyProfile>) => { touched.current = true; setDraft((current) => ({ ...current, ...patch })); };
  const updateLocation = (patch: Partial<PsyProfile["location"]>) => { touched.current = true; setDraft((current) => ({ ...current, location: { ...current.location, ...patch } })); };

  const openStep = (target: number) => { tap(); setStep(target); };
  const next = () => { select(); setStep(Math.min(flowSteps.length - 1, index + 1)); };
  const back = () => { tap(); setStep((current) => Math.max(0, current - 1)); };

  const current = flowSteps[step ?? 0];
  const index = step ?? 0;
  // Чего не хватает в открытом разделе. Раньше это всплывало только по кнопке
  // «Завершить» — человек доходил до конца и там узнавал про первый шаг.
  const missing = current.id === "preview" ? "" : validateStep(current.id, draft);

  return <div className={livePreview ? "@xl:grid @xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] @xl:items-start @xl:gap-5" : ""}>
    <div className="min-w-0">
    {/* Прогресс + шаги: можно вернуться на любой пройденный и дозаполнить позже */}
    <div className="mb-4 overflow-hidden rounded-[20px] bg-white stroke-lg">
      <div className="flex items-center gap-3 p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] stroke" style={{ background: current.tone }}><Icon name={current.icon} width={19} weight="bold" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.09em] text-[var(--muted)]">Раздел {index + 1} из {flowSteps.length} · анкета заполнена на <span className="tnum" style={{ color: "var(--tiffany-edge)" }}>{percent}%</span></p>
          <h3 className="font-tight text-[19px] font-black leading-tight">{current.title}</h3>
        </div>
      </div>
      <div className="flex gap-1 border-t px-3 py-2.5" style={{ borderColor: "var(--edge-neutral)" }}>
        {flowSteps.map((item, itemIndex) => {
          const isPreview = item.id === "preview";
          const done = !isPreview && isComplete(item.id, draft);
          const active = itemIndex === index;
          // Заполненные — зелёные, недозаполненные — янтарные (сигнал). Текущий
          // раздел чёрный и вдвое шире: где ты сейчас, видно без чтения.
          const bg = active ? "var(--ink)" : isPreview ? "var(--surface-2)" : done ? "var(--green)" : "var(--amber)";
          const edge = active ? "var(--ink)" : isPreview ? "var(--edge-neutral)" : done ? "var(--green-edge)" : "var(--amber-edge)";
          return (
            <button
              key={item.id}
              onClick={() => openStep(itemIndex)}
              aria-label={`${itemIndex + 1}. ${item.title}${done ? " — заполнено" : ""}`}
              aria-current={active}
              className={`h-2.5 rounded-full transition-all ${active ? "flex-[2.2]" : "flex-1"}`}
              style={{ background: bg, border: `2px solid ${edge}` }}
            />
          );
        })}
      </div>
      {/* Под полосками — только расшифровка цвета: название открытого раздела
          и так стоит в шапке выше, повторять его здесь незачем. */}
      <div className="flex items-center gap-3 border-t px-3 py-2" style={{ borderColor: "var(--edge-neutral)" }}>
        <span className="flex items-center gap-1.5 text-[10px] font-black text-[var(--muted)]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--green)", border: "2px solid var(--green-edge)" }} /> заполнено</span>
        <span className="flex items-center gap-1.5 text-[10px] font-black text-[var(--muted)]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--amber)", border: "2px solid var(--amber-edge)" }} /> ещё нужно заполнить</span>
      </div>
      <button onClick={() => { tap(); setNavOpen((value) => !value); }} className="flex w-full items-center justify-between border-t px-3 py-2.5 text-[12px] font-black text-[var(--muted)]" style={{ borderColor: "var(--edge-neutral)" }} aria-expanded={navOpen}>
        {navOpen ? "Свернуть разделы" : "Все разделы анкеты"}
        <motion.span animate={{ rotate: navOpen ? -90 : 90 }} className="flex shrink-0 items-center text-[var(--muted)]"><ArrowGlyph size={14} /></motion.span>
      </button>
      <Disclosure open={navOpen}>
        <div className="space-y-1.5 border-t px-3 py-3" style={{ borderColor: "var(--edge-neutral)" }}>
          {flowSteps.map((item, itemIndex) => {
            const isPreview = item.id === "preview";
            const done = !isPreview && isComplete(item.id, draft);
            const active = itemIndex === index;
            return (
              <button
                key={item.id}
                onClick={() => { openStep(itemIndex); setNavOpen(false); }}
                aria-current={active}
                className="flex w-full items-center gap-2.5 rounded-[13px] p-2.5 text-left transition-transform active:scale-[.99]"
                style={{ background: active ? "var(--ink)" : "transparent", border: `var(--bw) solid ${active ? "var(--ink)" : "var(--edge-neutral)"}`, color: active ? "#fff" : "inherit" }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]" style={{ background: item.tone }}><Icon name={item.icon} width={17} weight="bold" color="var(--ink)" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-black leading-tight">{itemIndex + 1}. {item.title}</span>
                  <span className="t-cap block" style={active ? { color: "rgba(255,255,255,.72)" } : undefined}>{item.short}</span>
                </span>
                {!isPreview && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[.05em]" style={{ background: done ? "var(--green-soft)" : "var(--amber-soft)", color: done ? "var(--green-edge)" : "var(--amber-edge)" }}>
                    {done ? "готово" : "нужно"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Disclosure>
    </div>

    {/* Статичная минимальная высота — окно не «скачет» между шагами */}
    <div className="min-h-[440px]">
    <AnimatePresence mode="wait" initial={false}><motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2, ease: [.16, 1, .3, 1] }}>
      {current.id === "identity" && <IdentityStep draft={draft} update={update} fileRef={fileRef} />}
      {current.id === "topics" && <TopicsStep draft={draft} update={update} />}
      {current.id === "methods" && <MethodsStep draft={draft} update={update} />}
      {current.id === "format" && <FormatStep draft={draft} update={update} updateLocation={updateLocation} />}
      {current.id === "conditions" && <ConditionsStep draft={draft} update={update} />}
      {current.id === "experience" && <ExperienceStep draft={draft} update={update} />}
      {current.id === "story" && <StoryStep draft={draft} update={update} />}
      {current.id === "rules" && <RulesStep draft={draft} update={update} />}
      {current.id === "preview" && <PublicProfilePreview profile={draft} name={draft.name || displayName()} photo={draft.photos[0] ?? displayPhoto()} />}
    </motion.div></AnimatePresence>
    </div>

    {missing && <p className="mt-3 rounded-[13px] px-3 py-2 text-[12px] font-bold stroke" style={{ background: "var(--amber-soft)", borderColor: "var(--amber-edge)" }}>{missing}</p>}

    {/* «Завершения» у анкеты нет — она сохраняется сама, — но листать разделы
        подряд удобнее кнопками, чем каждый раз открывая список. */}
    <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t bg-[var(--surface)] px-4 pb-1 pt-3" style={{ borderColor: "var(--edge-neutral)" }}>
      <div className="flex gap-2">
        <button className="btn px-5 disabled:opacity-0" onClick={back} disabled={index === 0} style={{ background: "transparent", color: "var(--ink)", borderColor: "var(--ink)" }}>Назад</button>
        {index === flowSteps.length - 1
          ? <Button className="flex-1" onClick={() => { tap(); router.push("/cabinet"); }}>В кабинет</Button>
          : <Button className="flex-1" onClick={next}>Далее</Button>}
      </div>
      <p className="mt-2 text-center text-[10px] font-semibold text-[var(--muted-2)]">Всё сохраняется само — уйти можно на любом разделе</p>
    </div>
    </div>
    {livePreview && (
      <aside className="hidden min-w-0 @xl:sticky @xl:top-4 @xl:block @xl:max-h-[calc(100dvh-32px)] @xl:overflow-y-auto">
        <div className="mb-2 flex items-center gap-2 px-1"><Icon name="user" width={15} weight="bold" color="var(--edge)" /><p className="t-head">Так профиль выглядит для клиента</p></div>
        <PublicProfilePreview profile={draft} name={draft.name || displayName()} photo={draft.photos[0] ?? displayPhoto()} />
      </aside>
    )}
  </div>;
}

function IdentityStep({ draft, update, fileRef }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void; fileRef: React.RefObject<HTMLInputElement | null> }) {
  const [photoError, setPhotoError] = useState("");
  // Файл, выбранный в проводнике, сначала попадает в кроппер: карточка каталога
  // режет портрет 3:4, и решать, что именно останется в кадре, должен человек.
  const [cropping, setCropping] = useState<File | null>(null);
  const onFile = (file?: File) => {
    if (!file) return;
    setPhotoError("");
    if (!file.type.startsWith("image/")) { setPhotoError("Подойдёт картинка: JPG, PNG или HEIC."); return; }
    if (file.size > MEDIA_LIMITS.input.maxBytes) {
      setPhotoError(`Фото тяжелее ${mb(MEDIA_LIMITS.input.maxBytes)} браузер не откроет. Выберите снимок полегче.`);
      return;
    }
    setCropping(file);
  };
  const addPhoto = (dataUrl: string) => {
    const photos = [...draft.photos, dataUrl].slice(0, 3);
    update({ photos, photo: photos[0] ?? null });
    setCropping(null);
  };
  const setMain = (index: number) => { select(); const photos = [draft.photos[index], ...draft.photos.filter((_, itemIndex) => itemIndex !== index)]; update({ photos, photo: photos[0] ?? null }); };
  const removePhoto = (index: number) => { tap(); const photos = draft.photos.filter((_, itemIndex) => itemIndex !== index); update({ photos, photo: photos[0] ?? null }); };
  return <StepCard>
    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; onFile(file); }} />
    {cropping && <PhotoCropper file={cropping} onCancel={() => setCropping(null)} onDone={addPhoto} />}
    <div>
      <span className="mb-1.5 block text-[12px] font-extrabold text-[var(--muted)]">Фото</span>
      <span className="mb-2 block text-[11px] font-semibold text-[var(--muted-2)]">Первое фото станет крупным портретом в каталоге. Можно добавить до трёх.</span>
      <div className="flex flex-wrap gap-2.5">{draft.photos.map((src, index) => <div key={`${src.slice(0, 20)}-${index}`} className="relative"><button onClick={() => setMain(index)} className="block h-[88px] w-[76px] overflow-hidden rounded-[15px] stroke" aria-label={index === 0 ? "Основное фото" : "Сделать основным"}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt="" className="h-full w-full object-cover" /></button><span className="absolute bottom-1 left-1 rounded-full bg-white px-1.5 py-0.5 text-[8px] font-black stroke">{index === 0 ? "основное" : `${index + 1}`}</span><button onClick={() => removePhoto(index)} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] font-black stroke" aria-label="Удалить фото">×</button></div>)}{draft.photos.length < 3 && <button onClick={() => fileRef.current?.click()} disabled={Boolean(cropping)} className="flex h-[88px] w-[76px] flex-col items-center justify-center gap-1 rounded-[15px] bg-white text-[10px] font-bold text-[var(--muted)] disabled:opacity-50" style={{ border: "var(--bw) dashed var(--edge-neutral)" }}><Icon name="plus" width={18} />Фото</button>}</div>
    </div>
    {photoError && <p className="rounded-[12px] px-3 py-2 text-[11px] font-bold" style={{ background: "var(--salmon-soft)" }}>{photoError}</p>}
    <Field label="Имя и фамилия"><Input value={draft.name} onChange={(event) => update({ name: event.target.value })} placeholder="Как к вам обращаться" /></Field>
    <RegionZoneFields draft={draft} update={update} />
    <Field label="Кто вы" hint="Можно выбрать несколько — все появятся в каталоге">
      <div className="flex flex-wrap gap-2">
        {SPECIALIST_TYPES.map((type) => {
          const list = draft.specialistTypes ?? [];
          const active = list.includes(type);
          return (
            <Choice
              key={type}
              active={active}
              onClick={() => update({ specialistTypes: active ? list.filter((t) => t !== type) : [...list, type] })}
            >
              {type}
            </Choice>
          );
        })}
      </div>
    </Field>
    <Field label="Пол"><div className="grid grid-cols-3 gap-2"><Choice active={draft.gender === "woman"} onClick={() => update({ gender: "woman" })}>Женщина</Choice><Choice active={draft.gender === "man"} onClick={() => update({ gender: "man" })}>Мужчина</Choice><Choice active={draft.gender === "unspecified"} onClick={() => update({ gender: "unspecified" })}>Не указывать</Choice></div></Field>
    <Field label="Языки консультации"><div className="flex flex-wrap gap-2">{[...new Set([...LANGUAGES, ...draft.languages])].map((language) => <Choice key={language} active={draft.languages.includes(language)} onClick={() => update({ languages: toggle(draft.languages, language) })}>{language}</Choice>)}</div><div className="mt-2"><ChipInput placeholder="Другой язык" onAdd={(v) => { if (!draft.languages.includes(v)) update({ languages: [...draft.languages, v] }); }} /></div></Field>
    <Field label="Telegram для связи"><div className="flex items-center gap-2 rounded-[13px] bg-white px-3 stroke"><span className="font-black text-[var(--muted-2)]">@</span><input value={draft.tg} onChange={(event) => update({ tg: event.target.value.replace(/^@/, "") })} placeholder="username" className="w-full bg-transparent py-2.5 text-sm font-semibold outline-none" /></div></Field>
    <Field label="Сайт и соцсети"><LinksEditor links={draft.links} onChange={(links) => update({ links })} /></Field>
  </StepCard>;
}

/**
 * Регион и часовой пояс. Онлайн-приёму адрес не нужен, а вот разница во
 * времени решает всё: клиент из Москвы и специалист из Лиссабона иначе читают
 * «вечернее окно». Часовой пояс по умолчанию предлагаем по устройству.
 */
function RegionZoneFields({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) {
  const zone = draft.timezone || "";
  const device = deviceTimezone();
  const options = [...new Set([...(zone ? [zone] : []), ...(device ? [device] : []), ...TIMEZONES.map((item) => item.id)])];
  return (
    <>
      <Field label="Регион или страна" hint="Где вы находитесь — клиент видит это в карточке">
        <Input value={draft.location.region ?? ""} onChange={(event) => update({ location: { ...draft.location, region: event.target.value } })} placeholder="Москва · Россия" />
      </Field>
      <Field label="Часовой пояс" hint="По нему клиент понимает, когда у вас окна">
        <select
          value={zone}
          onChange={(event) => { select(); update({ timezone: event.target.value }); }}
          className="w-full appearance-none rounded-[13px] bg-white px-3 py-2.5 text-[13px] font-semibold outline-none stroke"
        >
          <option value="">Не указан</option>
          {options.map((id) => <option key={id} value={id}>{zoneLabel(id)}</option>)}
        </select>
        {!zone && device && (
          <button onClick={() => { select(); update({ timezone: device }); }} className="mt-2 text-[11px] font-black" style={{ color: "var(--tiffany-edge)" }}>
            Подставить пояс устройства — {zoneLabel(device)}
          </button>
        )}
      </Field>
    </>
  );
}

// Ссылки на сайт и соцсети — с выбором типа; в профиле показываем мини-иконками.
function LinksEditor({ links, onChange }: { links: PsyProfile["links"]; onChange: (links: PsyProfile["links"]) => void }) {
  const kinds = Object.keys(LINK_META) as LinkKind[];
  const setAt = (i: number, patch: Partial<PsyProfile["links"][number]>) => onChange(links.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  // Ник, а не адрес: «https://» никто не пишет от руки, а @nick специалисты
  // диктуют не задумываясь — схему допишет normalizeLinkUrl.
  const hint = (kind: LinkKind) => (kind === "site" ? "site.ru" : "@nickname");
  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2">
          <select value={link.kind} onChange={(e) => setAt(i, { kind: e.target.value as LinkKind })} className="shrink-0 rounded-[11px] bg-white px-2 py-2.5 text-[12px] font-black stroke outline-none">
            {kinds.map((k) => <option key={k} value={k}>{LINK_META[k].label}</option>)}
          </select>
          <Input value={link.url} onChange={(e) => setAt(i, { url: e.target.value })} placeholder={hint(link.kind)} />
          <button onClick={() => onChange(links.filter((_, idx) => idx !== i))} className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-[11px] bg-white stroke" aria-label="Удалить">×</button>
        </div>
      ))}
      <button onClick={() => onChange([...links, { kind: "site", url: "" }])} className="flex w-full items-center justify-center gap-1.5 rounded-[11px] bg-white py-2 text-[13px] font-bold stroke"><Icon name="plus" width={15} /> Добавить ссылку</button>
      <p className="text-[10px] font-semibold leading-snug text-[var(--muted-2)]">Для соцсетей достаточно ника через собаку — @nickname. Для сайта хватит адреса вида site.ru, «https://» дописывать не нужно.</p>
      {hasRestrictedLink(links) && <p className="text-[9.5px] leading-snug text-[var(--muted-2)]">{INSTAGRAM_NOTE}</p>}
    </div>
  );
}

// Экран «анкета сохранена» убран вместе с кнопкой «Завершить»: сохранение идёт
// само на каждый затихший ввод, и отдельного финала у анкеты больше нет.

function TopicsStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) {
  const topicOptions = [...new Set([...TOPICS, ...draft.topics])];
  const avoids = draft.avoids ?? [];
  const addTopic = (value: string) => { if (!draft.topics.includes(value)) update({ topics: [...draft.topics, value] }); };
  const addAvoid = (value: string) => { if (!avoids.includes(value)) update({ avoids: [...avoids, value] }); };
  const topTopics = (draft.topTopics ?? []).filter((topic) => draft.topics.includes(topic));
  // Снятый запрос уводит с собой и звёздочку — иначе главным осталось бы то,
  // чего в анкете уже нет.
  const toggleTopic = (topic: string) => {
    const topics = toggle(draft.topics, topic);
    update({ topics, topTopics: topTopics.filter((item) => topics.includes(item)) });
  };
  const toggleTop = (topic: string) => {
    if (topTopics.includes(topic)) return update({ topTopics: topTopics.filter((item) => item !== topic) });
    if (topTopics.length >= 3) return;
    update({ topTopics: [...topTopics, topic] });
  };
  return <StepCard title="С чем к вам можно обратиться" hint="Выберите запросы или впишите свои. В миниатюре карточки покажем три основных — их вы отмечаете звёздочкой.">
    <div className="flex flex-wrap gap-2">
      {topicOptions.map((topic) => {
        const active = draft.topics.includes(topic);
        const top = topTopics.includes(topic);
        return (
          <span key={topic} className="inline-flex items-center overflow-hidden rounded-full" style={{ border: `var(--bw) solid var(--${active ? "tiffany-edge" : "edge-neutral"})`, background: active ? "var(--tiffany)" : "#fff" }}>
            <button onClick={() => { select(); toggleTopic(topic); }} className="py-2 pl-3 pr-1.5 text-[11px] font-black" style={{ color: "var(--ink)" }}>{topic}</button>
            {active && <button onClick={() => { select(); toggleTop(topic); }} disabled={!top && topTopics.length >= 3} className="flex h-7 w-7 items-center justify-center disabled:opacity-40" aria-label={top ? "Убрать из главных" : "Сделать главным"}><Icon name="star" width={14} weight={top ? "fill" : "regular"} color={top ? "var(--amber-edge)" : "var(--muted)"} /></button>}
          </span>
        );
      })}
    </div>
    <ChipInput placeholder="Свой запрос" onAdd={addTopic} />
    <p className="text-[11px] font-semibold leading-snug text-[var(--muted)]">Выбрано: {draft.topics.length}. Оптимально 3–7 запросов. Отмеченные звёздочкой стоят в карточке первыми — их можно выбрать до трёх.</p>
    <Field label="С чем не работаете (по желанию)">
      <div className="flex flex-wrap gap-2">{avoids.map((a) => <Choice key={a} active tone="coral" onClick={() => update({ avoids: avoids.filter((x) => x !== a) })}>{a} ×</Choice>)}</div>
      <div className="mt-2"><ChipInput placeholder="Например: зависимости" onAdd={addAvoid} /></div>
      <p className="mt-1 text-[10px] font-semibold text-[var(--muted-2)]">Появится в профиле блоком «с чем не работает» — помогает клиенту не ошибиться.</p>
    </Field>
  </StepCard>;
}

function MethodsStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) {
  const [custom, setCustom] = useState("");
  // Отметить/снять метод. Первый отмеченный автоматически становится основным.
  const toggleMethod = (method: string) => {
    const methods = toggle(draft.methods, method);
    const primaryMethod = methods.includes(draft.primaryMethod) ? draft.primaryMethod : (methods[0] ?? "");
    update({ methods, primaryMethod, approach: primaryMethod });
  };
  const setPrimary = (method: string) => update({ primaryMethod: method, approach: method });
  const addCustom = () => {
    const value = custom.trim();
    if (!value || draft.methods.includes(value)) { setCustom(""); return; }
    const methods = [...draft.methods, value];
    update({ methods, primaryMethod: draft.primaryMethod || value, approach: draft.primaryMethod || value });
    setCustom(""); tap();
  };
  const options = [...new Set([...METHODS, ...draft.methods])];
  return <StepCard title="В каких подходах работаете" hint="Отметьте свои школы — можно несколько. Первый становится основным (рядом с именем), его сменить можно тапом по звёздочке.">
    <div className="flex flex-wrap gap-2">
      {options.map((method) => {
        const active = draft.methods.includes(method);
        const primary = draft.primaryMethod === method;
        return (
          <span key={method} className="inline-flex items-center overflow-hidden rounded-full" style={{ border: `var(--bw) solid var(--${active ? "tiffany-edge" : "edge-neutral"})`, background: active ? "var(--tiffany)" : "#fff" }}>
            <button onClick={() => { select(); toggleMethod(method); }} className="py-2 pl-3 pr-1.5 text-[11px] font-black" style={{ color: "var(--ink)" }}>{method}</button>
            {active && <button onClick={() => { select(); setPrimary(method); }} className="flex h-7 w-7 items-center justify-center" aria-label={primary ? "Основной метод" : "Сделать основным"}><Icon name="star" width={14} weight={primary ? "fill" : "regular"} color={primary ? "var(--amber-edge)" : "var(--muted)"} /></button>}
          </span>
        );
      })}
    </div>
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-2 rounded-[13px] bg-white px-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><Icon name="plus" width={15} color="var(--muted-2)" /><input value={custom} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } }} placeholder="Свой подход" className="w-full bg-transparent py-2.5 text-[13px] font-semibold outline-none" /></div>
      <button onClick={addCustom} disabled={!custom.trim()} className="shrink-0 rounded-[12px] bg-[var(--ink)] px-4 py-2.5 text-[12px] font-black text-white disabled:opacity-40">Добавить</button>
    </div>
    {draft.primaryMethod && <p className="text-[11px] font-semibold text-[var(--muted)]">Основной метод: <span className="font-black text-[var(--ink)]">{draft.primaryMethod}</span></p>}
  </StepCard>;
}

function FormatStep({ draft, update, updateLocation }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void; updateLocation: (patch: Partial<PsyProfile["location"]>) => void }) {
  const online = draft.format === "online" || draft.format === "both";
  const offline = draft.format === "offline" || draft.format === "both";
  // Мультиформат: можно выбрать оба. Хотя бы один остаётся включённым.
  const toggleFormat = (which: "online" | "offline") => {
    const nextOnline = which === "online" ? !online : online;
    const nextOffline = which === "offline" ? !offline : offline;
    if (!nextOnline && !nextOffline) return;
    update({ format: nextOnline && nextOffline ? "both" : nextOnline ? "online" : "offline" });
  };
  return <StepCard title="Как проходят встречи" hint="Можно выбрать сразу оба формата. Точный адрес по умолчанию скрыт — вы сами решаете, показывать ли его.">
    <div className="grid grid-cols-2 gap-2">
      <FormatToggle active={online} icon="video" label="Онлайн" onClick={() => toggleFormat("online")} />
      <FormatToggle active={offline} icon="pin" label="Очно" onClick={() => toggleFormat("offline")} />
    </div>
    {offline && <div className="space-y-3">
      <Field label="Город"><Input value={draft.location.city} onChange={(event) => updateLocation({ city: event.target.value })} placeholder="Москва" /></Field>
      <Field label="Метро или ориентир"><Input value={draft.location.metro} onChange={(event) => updateLocation({ metro: event.target.value })} placeholder="м. Фрунзенская" /></Field>
      <Field label="Точный адрес"><Input value={draft.location.address} onChange={(event) => updateLocation({ address: event.target.value })} placeholder="Улица, дом, кабинет" /></Field>
      <label className="flex cursor-pointer items-start gap-3 py-1"><button role="switch" aria-checked={draft.location.publicExactAddress} onClick={(event) => { event.preventDefault(); select(); updateLocation({ publicExactAddress: !draft.location.publicExactAddress }); }} className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full stroke" style={{ background: draft.location.publicExactAddress ? "var(--ink)" : "var(--head-soft)" }}><motion.span animate={{ x: draft.location.publicExactAddress ? 20 : 2 }} className="absolute left-0 top-[2px] h-[18px] w-[18px] rounded-full bg-white" style={{ border: "var(--bw) solid var(--edge-neutral)" }} /></button><span><span className="block text-[12px] font-black">Показывать точный адрес в профиле</span><span className="mt-0.5 block text-[10px] font-semibold leading-relaxed text-[var(--muted)]">Если выключено, клиент увидит только город и метро. Точный адрес откроется после подтверждения записи.</span></span></label>
    </div>}
  </StepCard>;
}

function FormatToggle({ active, icon, label, onClick }: { active: boolean; icon: IconName; label: string; onClick: () => void }) {
  return (
    <button onClick={() => { select(); onClick(); }} className="flex items-center justify-center gap-2 rounded-[14px] py-3 text-[13px] font-black transition-transform active:scale-[0.98]" style={{ background: active ? "var(--tiffany)" : "#fff", border: `var(--bw) solid var(--${active ? "tiffany-edge" : "edge-neutral"})`, color: "var(--ink)" }}>
      <Icon name={icon} width={17} weight="bold" /> {label}
    </button>
  );
}

function ConditionsStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) {
  const currency = toCurrency(draft.currency);
  const low = draft.sessionPrice > 0 && draft.sessionPrice < MIN_PRICE[currency];
  return <StepCard title="Условия одной встречи" hint="Именно эти значения используются в фильтрах и на карточке каталога.">
    <Field label="Валюта оплаты" hint="Принимаете оплату не в рублях — выберите доллар или евро, каталог отфильтрует по ней">
      <div className="grid grid-cols-3 gap-2">{CURRENCIES.map((item) => <Choice key={item.code} active={currency === item.code} onClick={() => update({ currency: item.code })}>{item.short}</Choice>)}</div>
    </Field>
    <Field label={`Стоимость, ${currencySymbol(currency)}`}>
      <Input type="number" min={0} step={currency === "RUB" ? 100 : 5} value={draft.sessionPrice || ""} placeholder={currency === "RUB" ? "3500" : "60"} onChange={(event) => update({ sessionPrice: Number(event.target.value) })} />
      <p className="mt-1 text-[10px] font-semibold" style={{ color: low ? "var(--salmon-edge)" : "var(--muted-2)" }}>Шкала каталога начинается с {formatMoney(MIN_PRICE[currency], currency)}{low ? " — с меньшей ценой вас не найдут по фильтру" : ""}.</p>
    </Field><Field label="Длительность"><div className="flex items-center gap-2.5"><button onClick={() => { select(); update({ sessionMinutes: draft.sessionMinutes ? Math.max(30, draft.sessionMinutes - 5) : 50 }); }} className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white text-[20px] font-black stroke" aria-label="Уменьшить">−</button><div className="flex h-11 min-w-[104px] items-center justify-center rounded-[12px] bg-[var(--head-soft)] px-3 stroke"><span className="tnum text-[16px] font-black">{draft.sessionMinutes ? `${draft.sessionMinutes} мин` : "не выбрано"}</span></div><button onClick={() => { select(); update({ sessionMinutes: draft.sessionMinutes ? Math.min(120, draft.sessionMinutes + 5) : 50 }); }} className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white text-[20px] font-black stroke" aria-label="Увеличить">+</button></div></Field></StepCard>; }

function ExperienceStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) {
  const setEducation = (index: number, value: string) => update({ education: draft.education.map((item, itemIndex) => itemIndex === index ? value : item) });
  return <StepCard title="Опыт и квалификация" hint="Клиент сможет отфильтровать по опыту и отдельно изучить образование."><Field label="Лет практики"><Input type="number" min={0} max={70} value={draft.experienceYears} onChange={(event) => update({ experienceYears: event.target.value })} placeholder="5" /><div className="mt-2 flex gap-2">{EXPERIENCE_OPTIONS.slice(1).map((years) => <Choice key={years} active={Number(draft.experienceYears) === years} onClick={() => update({ experienceYears: String(years) })}>от {years} лет</Choice>)}</div></Field><Field label="Образование и значимые программы"><div className="space-y-2">{draft.education.map((item, index) => <div key={index} className="flex gap-2"><Input value={item} onChange={(event) => setEducation(index, event.target.value)} placeholder="Учебное заведение, программа, год" /><button onClick={() => update({ education: draft.education.filter((_, itemIndex) => itemIndex !== index) })} className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-[11px] bg-white stroke" aria-label="Удалить">×</button></div>)}<button onClick={() => update({ education: [...draft.education, ""] })} className="flex w-full items-center justify-center gap-1.5 rounded-[11px] bg-white py-2 text-[13px] font-bold stroke"><Icon name="plus" width={15} /> Добавить образование</button></div></Field></StepCard>;
}

function StoryStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) {
  const styleOptions = [...new Set([...STYLE_OPTIONS, ...(draft.style ? [draft.style] : [])])];
  return <StepCard title="Помогите почувствовать, каково с вами" hint="Без обещаний результата: спокойно расскажите о стиле работы и первой встрече.">
    <Field label="Стиль работы"><div className="flex flex-wrap gap-2">{styleOptions.map((s) => <Choice key={s} active={draft.style === s} onClick={() => update({ style: draft.style === s ? "" : s })}>{s}</Choice>)}</div><div className="mt-2"><ChipInput placeholder="Свой вариант стиля" onAdd={(v) => update({ style: v })} /></div><p className="mt-1 text-[10px] font-semibold text-[var(--muted-2)]">Покажем в шапке профиля: «стиль: …».</p></Field>
    <Field label="Короткая цитата для карточки"><Input value={draft.quote} onChange={(event) => update({ quote: event.target.value })} placeholder="Напр.: Тревога — не приговор. Разберём её по шагам." /><Counter value={draft.quote} recommended="до 80 знаков" /></Field>
    <Field label="О себе и подходе"><Textarea autoGrow value={draft.about} onChange={(event) => update({ about: event.target.value })} placeholder={"Как вы строите работу, что для вас важно в контакте…\n\nПустая строка начинает новый абзац — так и покажем в каталоге."} rows={5} /><Counter value={draft.about} recommended="400–900 знаков" /></Field>
    <Field label="Как проходит первая встреча"><Textarea autoGrow value={draft.firstSession} onChange={(event) => update({ firstSession: event.target.value })} placeholder="Что обсудите, как определите запрос и следующий шаг…" rows={5} /><Counter value={draft.firstSession} recommended="250–600 знаков" /></Field>
  </StepCard>;
}

// Настройки анкеты: что из платформенных цифр показывать и какие правила
// работы видит клиент в каталоге.
function RulesStep({ draft, update }: { draft: PsyProfile; update: (patch: Partial<PsyProfile>) => void }) {
  const rules = normalizeRules(draft.rules);
  const setRule = (id: RuleId, patch: Partial<{ text: string; shown: boolean }>) => update({ rules: { ...rules, [id]: { ...rules[id], ...patch } } });
  return <StepCard title="Настройки анкеты и правила работы">
    <Field label="Статистика в анкете">
      {/* Счётчики по умолчанию выключены: у новичка «0 клиентов, 0 сессий» —
          это не аргумент за него, а против. Включает тот, кому есть что
          показать. */}
      <SwitchRow
        active={draft.showStats === true}
        title="Показывать счётчики платформы"
        text="Сколько у вас клиентов, сколько проведено сессий и сколько лет практики."
        onToggle={() => update({ showStats: draft.showStats !== true })}
      />
    </Field>

    {RULE_PRESETS.map((preset) => (
      <RuleField key={preset.id} preset={preset} rule={rules[preset.id]} onChange={(patch) => setRule(preset.id, patch)} />
    ))}

    {/* Текст правила — обещание клиенту, а не запрет в коде. Сам запрет живёт
        в графике: без этой строчки психологи ждали, что формулировка сама
        закроет запись за день до встречи. */}
    <p className="t-cap">
      Это формулировки для карточки. Чтобы запись и отмена действительно
      закрывались, задайте дни в разделе «Сессии» → «Правила приёма»:
      запрет отмены и предварительная запись очно и онлайн.
    </p>
  </StepCard>;
}

/**
 * Одно правило работы: заготовки и своя формулировка — одинаковыми блоками,
 * между которыми выбирают. Раньше «своя формулировка» была просто полем под
 * списком: непонятно, выбрана она или нет, и что в итоге уйдёт в карточку.
 */
function RuleField({ preset, rule, onChange }: {
  preset: (typeof RULE_PRESETS)[number];
  rule: { text: string; shown: boolean };
  onChange: (patch: Partial<{ text: string; shown: boolean }>) => void;
}) {
  const matched = preset.options.includes(rule.text);
  // Своё правило выбрано, когда текст не совпал ни с одной заготовкой, — либо
  // когда человек сам открыл этот блок под пустым текстом.
  const [customOpen, setCustomOpen] = useState(!matched && rule.text.trim().length > 0);
  const custom = customOpen || (!matched && rule.text.trim().length > 0);

  return (
    <Field label={preset.title} hint={preset.hint}>
      <div className="space-y-2">
        {preset.options.map((option) => (
          <SettingToggle key={option} bold={false} active={!custom && rule.text === option} title={option} onToggle={() => { setCustomOpen(false); onChange({ text: option }); }} />
        ))}
        <SettingToggle
          bold={false}
          active={custom}
          title="Своя формулировка"
          text={custom ? undefined : "Написать правило своими словами"}
          onToggle={() => { setCustomOpen(true); if (matched) onChange({ text: rule.text }); }}
        />
        {custom && (
          <div className="rounded-[13px] p-3" style={{ background: "var(--surface-2)", border: "var(--bw) solid var(--tiffany-edge)" }}>
            <Textarea value={rule.text} onChange={(event) => onChange({ text: event.target.value })} placeholder={preset.placeholder} rows={3} />
            <p className="mt-1 text-[10px] font-semibold text-[var(--muted-2)]">В карточку уйдёт именно этот текст.</p>
          </div>
        )}
      </div>
      <div className="mt-2.5">
        <SwitchRow
          active={rule.shown}
          title="Показывать это правило в профиле"
          text={rule.shown ? "Клиент увидит формулировку в карточке" : "Правило останется только у вас"}
          onToggle={() => onChange({ shown: !rule.shown })}
        />
      </div>
    </Field>
  );
}

/**
 * Настройка «включено / выключено» тумблером и словом. Круглая галочка на её
 * месте читалась как «выбор из списка», и было не понять, что сейчас включено.
 */
function SwitchRow({ active, title, text, onToggle }: { active: boolean; title: string; text?: string; onToggle: () => void }) {
  return (
    <button
      onClick={() => { select(); onToggle(); }}
      role="switch"
      aria-checked={active}
      className="flex w-full items-center gap-3 rounded-[13px] bg-white p-3 text-left transition-transform active:scale-[.99]"
      style={{ border: `var(--bw) solid ${active ? "var(--tiffany-edge)" : "var(--edge-neutral)"}` }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-black leading-snug">{title}</span>
        {text && <span className="t-cap mt-0.5 block">{text}</span>}
        <span className="mt-1 block text-[10px] font-black uppercase tracking-[.06em]" style={{ color: active ? "var(--tiffany-edge)" : "var(--muted-2)" }}>{active ? "включено" : "выключено"}</span>
      </span>
      <span className="relative h-6 w-11 shrink-0 rounded-full stroke" style={{ background: active ? "var(--tiffany-edge)" : "var(--head-soft)" }}>
        <motion.span animate={{ x: active ? 20 : 2 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} className="absolute left-0 top-[2px] h-[18px] w-[18px] rounded-full bg-white" style={{ border: "var(--bw) solid var(--edge-neutral)" }} />
      </span>
    </button>
  );
}

// Строка-переключатель настроек анкеты: квадрат-галочка слева по центру,
// выбранная строка обведена в тон. Вариант bare («показывать в профиле») —
// круглая отметка в оранжевой обводке.
function SettingToggle({ active, title, text, bare = false, bold = true, onToggle }: { active: boolean; title: string; text?: string; bare?: boolean; bold?: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={() => { select(); onToggle(); }}
      className={`flex w-full items-center gap-3 text-left transition-transform active:scale-[.99] ${bare ? "px-0.5 py-1" : "rounded-[13px] bg-white p-3"}`}
      style={bare ? undefined : { border: `var(--bw) solid ${active ? "var(--tiffany-edge)" : "var(--edge-neutral)"}` }}
      aria-pressed={active}
    >
      <span
        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center ${bare ? "rounded-full" : "rounded-[6px]"}`}
        style={bare
          ? { border: "2.5px solid var(--peach-edge)", background: active ? "var(--peach-soft)" : "white" }
          : { border: "2px solid var(--ink)", background: "white" }}
      >
        {active && <Icon name="check" width={bare ? 13 : 15} weight="bold" color={bare ? "var(--peach-edge)" : "var(--ink)"} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block leading-snug ${bold ? "text-[13px] font-black" : "text-[12.5px] font-semibold"}`}>{title}</span>
        {text && <span className="t-cap mt-0.5 block">{text}</span>}
      </span>
    </button>
  );
}

// Без заливки: шаг анкеты — это список выборов, фон под ним только рябит.
function StepCard({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) { return <section className="chunk space-y-4 p-4">{(title || hint) && <div>{title && <h4 className="font-tight text-[18px] font-black">{title}</h4>}{hint && <p className="t-cap mt-1">{hint}</p>}</div>}{children}</section>; }
function Choice({ active, onClick, children, tone = "tiffany" }: { active: boolean; onClick: () => void; children: ReactNode; tone?: string }) { return <motion.button layout initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} whileTap={{ scale: 0.9 }} onClick={() => { select(); onClick(); }} className="rounded-full px-3 py-2 text-[11px] font-black" style={active ? { background: `var(--${tone})`, color: "var(--ink)", border: `var(--bw) solid var(--${tone}-edge)` } : { background: "white", border: "var(--bw) solid var(--edge-neutral)" }}>{children}</motion.button>; }

// Компактный ввод своего варианта — добавляет строку в список по Enter/кнопке.
function ChipInput({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  const commit = () => { const v = value.trim(); if (!v) return; onAdd(v); setValue(""); tap(); };
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-2 rounded-[13px] bg-white px-3" style={{ border: "var(--bw) solid var(--edge-neutral)" }}><Icon name="plus" width={15} color="var(--muted-2)" /><input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} placeholder={placeholder} className="w-full bg-transparent py-2.5 text-[13px] font-semibold outline-none" /></div>
      <button onClick={commit} disabled={!value.trim()} className="shrink-0 rounded-[12px] bg-[var(--ink)] px-4 py-2.5 text-[12px] font-black text-white disabled:opacity-40">Добавить</button>
    </div>
  );
}
function Counter({ value, recommended }: { value: string; recommended: string }) { return <p className="mt-1 text-right text-[10px] font-semibold text-[var(--muted-2)]">{value.length} · рекомендуем {recommended}</p>; }

function BasicProfileForm({ onDone }: { onDone: () => void }) {
  const current = getPsyProfile();
  const [name, setName] = useState(current?.name || displayName());
  const [tg, setTg] = useState((current?.tg || tgUsername() || "").replace(/^@/, ""));
  return <div className="space-y-4"><Field label="Имя"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Как к вам обращаться" /></Field><Field label="Telegram"><div className="flex items-center gap-2 rounded-[13px] bg-white px-3 stroke"><span className="font-black text-[var(--muted-2)]">@</span><input value={tg} onChange={(event) => setTg(event.target.value.replace(/^@/, ""))} placeholder="username" className="w-full bg-transparent py-2.5 text-sm font-semibold outline-none" /></div></Field><Button className="w-full" onClick={() => { savePsyProfile({ name: name.trim(), tg: tg.trim() }); success(); onDone(); }}>Сохранить</Button></div>;
}

function ProfilePhoto({ photo, name, size }: { photo: string | null; name: string; size: "sm" | "lg" }) {
  const classes = size === "sm" ? "h-20 w-20 rounded-[18px] text-[26px]" : "h-[92px] w-[78px] rounded-[18px] text-[28px]";
  if (photo) return <div className={`${classes} shrink-0 overflow-hidden stroke`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo} alt="" className="h-full w-full object-cover" /></div>;
  return <div className={`${classes} flex shrink-0 items-center justify-center bg-[var(--head-soft)] font-black stroke`}>{name.trim().charAt(0).toUpperCase() || "П"}</div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-extrabold text-[var(--muted)]">{label}</span>
      {hint && <span className="mb-1.5 block text-[11px] font-semibold text-[var(--muted-2)]">{hint}</span>}
      {children}
    </label>
  );
}

function mergeProfile(profile: PsyProfile | null): PsyProfile {
  const merged = { ...EMPTY_PROFILE, ...(profile ?? {}), location: { ...EMPTY_PROFILE.location, ...(profile?.location ?? {}) } };
  merged.name ||= displayName();
  merged.tg ||= tgUsername();
  merged.primaryMethod ||= merged.approach;
  merged.approach = merged.primaryMethod;
  // Раньше специальность была одна строкой — переносим её в список.
  if (!merged.specialistTypes?.length) merged.specialistTypes = merged.specialistType ? [merged.specialistType] : ["Психолог"];
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

// Заполненность анкеты в процентах. Нужна не только полосе прогресса, но и
// заявке на каталог: там 90% — условие приёма.
export function profileCompletionPercent(profile: PsyProfile | null) {
  const merged = mergeProfile(profile);
  const steps = STEPS.slice(0, -1);
  return Math.round((steps.filter((item) => isComplete(item.id, merged)).length / steps.length) * 100);
}
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
  if (step === "format") {
    if (!profile.format) return "Выберите формат приёма.";
    if (profile.format !== "online") {
      if (!profile.location.city.trim()) return "Для очного приёма укажите город.";
      if (profile.location.publicExactAddress && !profile.location.address.trim()) return "Введите точный адрес или выключите его публичный показ.";
    }
  }
  if (step === "conditions") {
    if (!Number.isFinite(profile.sessionPrice) || profile.sessionPrice <= 0) return "Укажите стоимость одной встречи.";
    if (profile.sessionMinutes < 30) return "Длительность встречи должна быть не меньше 30 минут.";
  }
  if (step === "rules" && !rulesFilled(profile.rules)) return "Сформулируйте оба правила — об отмене и о связи между встречами.";
  if (step === "experience") {
    if (profile.experienceYears === "" || Number(profile.experienceYears) < 0) return "Укажите опыт практики в годах.";
    if (!profile.education.some((item) => item.trim())) return "Добавьте хотя бы одно образование или значимую программу.";
  }
  if (step === "story") {
    if (profile.about.trim().length < 10) return "Расскажите о себе — минимум 10 знаков.";
    if (profile.firstSession.trim().length < 10) return "Опишите первую встречу — минимум 10 знаков.";
  }
  return "";
}
