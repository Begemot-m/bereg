"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Badge, Button, Input, Textarea } from "@/components/ui";
import { select, success, tap } from "@/lib/haptics";
import { displayName, displayPhoto, getPsyProfile, savePsyProfile, tgUser, useProfile, type PsyProfile } from "@/lib/profile";

const SUGGESTED = ["тревога", "депрессия", "выгорание", "отношения", "границы", "самооценка", "травма", "утрата", "зависимости", "панические атаки", "стресс", "сон", "прокрастинация", "одиночество"];

export function ProfileEditor({
  embedded = false,
  professional = true,
  roleControl,
}: {
  embedded?: boolean;
  professional?: boolean;
  roleControl?: ReactNode;
}) {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const name = profile?.name || displayName();
  const photo = displayPhoto();

  return (
    <>
      <div className={embedded ? "space-y-4" : "chunk p-4"}>
        <div className="flex items-center gap-3">
          <ProfilePhoto photo={photo} name={name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[17px] font-extrabold">{name}</p>
              {professional && profile && (profile.status === "approved" ? <Badge tone="active">✓</Badge> : <Badge tone="planned">на проверке</Badge>)}
            </div>
            <p className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">
              {professional ? "Профиль психолога" : "Профиль клиента"}
            </p>
          </div>
        </div>

        {roleControl}

        <div className="flex items-center gap-2">
          {professional && (
            <button
              onClick={() => { tap(); setPreview(true); }}
              className="shrink-0 rounded-full px-3 py-2 text-[11px] font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              Как видят мой профиль
            </button>
          )}
          <button
            onClick={() => { tap(); setEditing(true); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[11px] font-bold stroke"
            style={{ background: "#fff" }}
          >
            <Icon name="note" width={13} weight="regular" /> Редактировать профиль
          </button>
        </div>
      </div>

      <ProfileSheet open={editing} title="Редактирование профиля" onClose={() => setEditing(false)}>
        {professional ? <ProfileForm onDone={() => setEditing(false)} /> : <BasicProfileForm onDone={() => setEditing(false)} />}
      </ProfileSheet>

      <ProfileSheet open={preview} title="Так профиль видит клиент" onClose={() => setPreview(false)}>
        <PublicProfilePreview profile={profile} name={name} photo={photo} />
      </ProfileSheet>
    </>
  );
}

function ProfileSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = old; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center @md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-[rgba(32,28,24,.34)]" onClick={onClose} aria-label="Закрыть" />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 32, opacity: 0.7 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[30px] bg-[var(--surface)] px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 stroke-lg @md:rounded-[30px] @md:p-6"
          >
            <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-4 bg-[var(--surface)] pb-2">
              <h2 className="font-tight text-xl font-extrabold">{title}</h2>
              <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full stroke" aria-label="Закрыть">×</button>
            </div>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PublicProfilePreview({ profile, name, photo }: { profile: PsyProfile | null; name: string; photo: string | null }) {
  const topics = profile?.topics ?? [];
  const education = profile?.education ?? [];
  return (
    <article className="space-y-4">
      <div className="chunk fill-purple p-4">
        <div className="flex items-center gap-3">
          <ProfilePhoto photo={photo} name={name} size="lg" />
          <div className="min-w-0">
            <h3 className="font-tight text-[22px] font-extrabold leading-tight">{name}</h3>
            <p className="mt-1 text-[13px] font-bold text-[var(--muted)]">
              {[profile?.approach, profile?.experienceYears ? `${profile.experienceYears} лет практики` : ""].filter(Boolean).join(" · ") || "Психолог платформы"}
            </p>
          </div>
        </div>
      </div>

      {profile?.about ? (
        <section className="chunk p-4">
          <p className="mb-1 text-[12px] font-extrabold text-[var(--muted)]">О специалисте</p>
          <p className="text-[14px] leading-relaxed">{profile.about}</p>
        </section>
      ) : <PreviewEmpty text="Добавьте рассказ о себе — он появится здесь." />}

      {topics.length > 0 && (
        <section>
          <p className="mb-2 text-[12px] font-extrabold text-[var(--muted)]">С чем можно обратиться</p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic) => <span key={topic} className="rounded-full bg-white px-3 py-1 text-[12px] font-bold stroke">{topic}</span>)}
          </div>
        </section>
      )}

      {education.length > 0 && (
        <section className="chunk p-4">
          <p className="mb-2 text-[12px] font-extrabold text-[var(--muted)]">Образование</p>
          <ul className="space-y-2">
            {education.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-[13px]"><Icon name="check" width={16} className="mt-0.5 shrink-0" />{item}</li>)}
          </ul>
        </section>
      )}

      <Button className="w-full" disabled>Записаться на сессию</Button>
      <p className="text-center text-[11px] text-[var(--muted-2)]">Предпросмотр. Кнопка записи здесь неактивна.</p>
    </article>
  );
}

function PreviewEmpty({ text }: { text: string }) {
  return <div className="rounded-[18px] bg-[var(--surface-2)] p-4 text-[13px] font-semibold text-[var(--muted)] stroke">{text}</div>;
}

function ProfileForm({ onDone }: { onDone: () => void }) {
  const cur = getPsyProfile();
  const [name, setName] = useState(cur?.name || displayName());
  const [approach, setApproach] = useState(cur?.approach || "");
  const [education, setEducation] = useState<string[]>(cur?.education?.length ? cur.education : []);
  const [about, setAbout] = useState(cur?.about || "");
  const [years, setYears] = useState(cur?.experienceYears || "");
  const [topics, setTopics] = useState<string[]>(cur?.topics || []);
  const [photo, setPhoto] = useState<string | null>(cur?.photo ?? null);
  const [manual, setManual] = useState("");
  const [topicsOpen, setTopicsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shownPhoto = photo || displayPhoto();
  const tgPhoto = tgUser()?.photo_url ?? null;

  const toggleTopic = (topic: string) => { select(); setTopics((current) => current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic]); };
  const addManual = () => { const value = manual.trim().toLowerCase(); if (value && !topics.includes(value)) setTopics([...topics, value]); setManual(""); };
  const onFile = (file: File | undefined) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { setPhoto(String(reader.result)); tap(); }; reader.readAsDataURL(file); };
  const save = () => {
    savePsyProfile({ name: name.trim(), approach: approach.trim(), education: education.map((item) => item.trim()).filter(Boolean), about: about.trim(), experienceYears: years.trim(), topics, photo });
    success(); onDone();
  };
  const shownTopics = topicsOpen ? [...new Set([...topics, ...SUGGESTED])] : [...new Set([...topics, ...SUGGESTED])].slice(0, 9);

  return (
    <div className="space-y-4">
      <FormSection number="01" title="Основное" hint="Фото и имя — первое, что увидит клиент.">
        <div className="flex items-center gap-4">
          <ProfilePhoto photo={shownPhoto} name={name} size="lg" />
          <div className="space-y-1.5">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
            <Button size="sm" variant="soft" onClick={() => fileRef.current?.click()}>Изменить фото</Button>
            {photo && <button onClick={() => setPhoto(null)} className="block text-[11px] font-semibold text-[var(--muted)]">{tgPhoto ? "Вернуть фото из Telegram" : "Убрать фото"}</button>}
          </div>
        </div>
        <Field label="Имя и фамилия"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Как к вам обращаться" /></Field>
      </FormSection>

      <FormSection number="02" title="Специализация" hint="Помогает клиенту понять, подходите ли вы друг другу.">
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
          <Field label="Подход"><Input value={approach} onChange={(event) => setApproach(event.target.value)} placeholder="КПТ, ACT…" /></Field>
          <Field label="Опыт"><Input value={years} onChange={(event) => setYears(event.target.value)} inputMode="numeric" placeholder="5 лет" /></Field>
        </div>
        <div>
          <p className="mb-2 text-[12px] font-extrabold text-[var(--muted)]">С какими запросами работаю</p>
          <div className="flex flex-wrap gap-1.5">
            {shownTopics.map((topic) => {
              const active = topics.includes(topic);
              return <button key={topic} onClick={() => toggleTopic(topic)} className="rounded-full px-2.5 py-1 text-[12px] font-bold transition-transform active:scale-95 stroke" style={active ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" } : { background: "#fff" }}>{active ? "✓ " : ""}{topic}</button>;
            })}
            <button onClick={() => setTopicsOpen(!topicsOpen)} className="px-2 text-[12px] font-bold text-[var(--muted)]">{topicsOpen ? "свернуть" : "ещё…"}</button>
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={manual} onChange={(event) => setManual(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addManual(); } }} placeholder="Добавить свой запрос" />
            <Button size="sm" variant="soft" onClick={addManual}>+</Button>
          </div>
        </div>
      </FormSection>

      <FormSection number="03" title="Образование" hint="Добавьте дипломы и значимые программы обучения.">
        <div className="space-y-2">
          {education.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input value={item} onChange={(event) => setEducation((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} placeholder="Учебное заведение, программа, год" />
              <button onClick={() => { tap(); setEducation((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[var(--muted)] stroke" aria-label="Удалить">×</button>
            </div>
          ))}
          <button onClick={() => { tap(); setEducation((current) => [...current, ""]); }} className="flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-white py-2 text-[13px] font-bold stroke"><Icon name="plus" width={15} /> Добавить образование</button>
        </div>
      </FormSection>

      <FormSection number="04" title="О себе" hint="Коротко расскажите о стиле работы и том, чего ждать от встреч.">
        <Field label="Описание"><Textarea value={about} onChange={(event) => setAbout(event.target.value)} rows={5} placeholder="Несколько живых предложений о вашей практике" /></Field>
      </FormSection>

      <div className="sticky bottom-0 -mx-1 flex gap-2 bg-[var(--surface)] px-1 pb-1 pt-3">
        <Button variant="soft" size="sm" onClick={onDone}>Отмена</Button>
        <Button className="flex-1" onClick={save}>Сохранить профиль</Button>
      </div>
    </div>
  );
}

function BasicProfileForm({ onDone }: { onDone: () => void }) {
  const cur = getPsyProfile();
  const [name, setName] = useState(cur?.name || displayName());
  const [photo, setPhoto] = useState<string | null>(cur?.photo ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shownPhoto = photo || displayPhoto();
  const onFile = (file: File | undefined) => { if (!file) return; const reader = new FileReader(); reader.onload = () => setPhoto(String(reader.result)); reader.readAsDataURL(file); };
  const save = () => { savePsyProfile({ name: name.trim(), photo }); success(); onDone(); };

  return (
    <div className="space-y-4">
      <FormSection number="01" title="Профиль" hint="Имя и фото используются в ваших записях.">
        <div className="flex items-center gap-4">
          <ProfilePhoto photo={shownPhoto} name={name} size="lg" />
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
            <Button size="sm" variant="soft" onClick={() => fileRef.current?.click()}>Изменить фото</Button>
          </div>
        </div>
        <Field label="Имя и фамилия"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      </FormSection>
      <div className="flex gap-2"><Button variant="soft" size="sm" onClick={onDone}>Отмена</Button><Button className="flex-1" onClick={save}>Сохранить</Button></div>
    </div>
  );
}

function FormSection({ number, title, hint, children }: { number: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-[22px] bg-[var(--surface-2)] p-4 stroke">
      <div className="mb-4 flex gap-3">
        <span className="font-mono text-[11px] font-extrabold text-[var(--muted-2)]">{number}</span>
        <div><h3 className="font-tight text-[17px] font-extrabold">{title}</h3><p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{hint}</p></div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ProfilePhoto({ photo, name, size }: { photo: string | null; name: string; size: "sm" | "lg" }) {
  const dimensions = size === "lg" ? "h-20 w-20 rounded-[20px] text-2xl" : "h-16 w-16 rounded-[16px] text-xl";
  return (
    <div className={`${dimensions} shrink-0 overflow-hidden bg-[var(--head-soft)] stroke`}>
      {photo ? <img src={photo} alt={`Фото профиля ${name}`} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-extrabold">{(name || "П").charAt(0).toUpperCase()}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[12px] font-extrabold text-[var(--muted)]">{label}</span>{children}</label>;
}
