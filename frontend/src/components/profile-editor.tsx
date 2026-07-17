"use client";

import { useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge, Button, Input, Textarea } from "@/components/ui";
import { select, success, tap } from "@/lib/haptics";
import { displayName, displayPhoto, getPsyProfile, savePsyProfile, tgUser, useProfile } from "@/lib/profile";

const SUGGESTED = ["тревога", "депрессия", "выгорание", "отношения", "границы", "самооценка", "травма", "утрата", "зависимости", "панические атаки", "стресс", "сон", "прокрастинация", "одиночество"];

// Единый блок профиля: показ + инлайн-редактирование.
export function ProfileEditor() {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);

  const tg = tgUser();
  const nick = tg?.username ? `@${tg.username}` : "привязка к Telegram";
  const name = profile?.name || displayName();
  const photo = displayPhoto();
  const about = profile?.about?.trim();
  const topics = profile?.topics ?? [];

  if (editing) return <ProfileForm onDone={() => setEditing(false)} />;

  return (
    <div className="chunk p-4">
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[16px] stroke" style={{ background: "var(--head-soft)" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold">{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[16px] font-extrabold">{name}</p>
            {profile && (profile.status === "approved" ? <Badge tone="active">✓</Badge> : <Badge tone="planned">на проверке</Badge>)}
          </div>
          <p className="text-[12px] font-semibold text-[var(--muted)]">{nick}</p>
          {profile?.approach && <p className="mt-0.5 text-[12px] font-bold" style={{ color: "var(--stroke)" }}>{profile.approach}{profile.experienceYears ? ` · ${profile.experienceYears} лет` : ""}</p>}
        </div>
      </div>

      {about && <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">{about}</p>}

      {topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topics.slice(0, 6).map((t) => (
            <span key={t} className="rounded-full px-2.5 py-0.5 text-[11px] font-bold stroke" style={{ background: "#fff" }}>{t}</span>
          ))}
          {topics.length > 6 && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[var(--muted)]">+{topics.length - 6}</span>}
        </div>
      )}

      <button onClick={() => { tap(); setEditing(true); }} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-extrabold stroke" style={{ background: "#fff" }}>
        <Icon name="note" width={15} weight="regular" /> Редактировать профиль
      </button>
    </div>
  );
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

  const toggleTopic = (t: string) => { select(); setTopics((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t])); };
  const addManual = () => { const v = manual.trim().toLowerCase(); if (v && !topics.includes(v)) { tap(); setTopics([...topics, v]); } setManual(""); };
  const onFile = (f: File | undefined) => { if (!f) return; const r = new FileReader(); r.onload = () => { setPhoto(String(r.result)); tap(); }; r.readAsDataURL(f); };

  const setEdu = (i: number, v: string) => setEducation((e) => e.map((x, k) => (k === i ? v : x)));
  const addEdu = () => { tap(); setEducation((e) => [...e, ""]); };
  const rmEdu = (i: number) => { tap(); setEducation((e) => e.filter((_, k) => k !== i)); };

  const save = () => {
    savePsyProfile({ name: name.trim(), approach: approach.trim(), education: education.map((e) => e.trim()).filter(Boolean), about: about.trim(), experienceYears: years.trim(), topics, photo });
    success();
    onDone();
  };

  const shown = topicsOpen ? [...new Set([...topics, ...SUGGESTED])] : [...new Set([...topics, ...SUGGESTED])].slice(0, 10);

  return (
    <div className="chunk space-y-4 p-4">
      {/* Фото */}
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[18px] stroke" style={{ background: "var(--head-soft)" }}>
          {shownPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownPhoto} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold">{(name || "П").charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="space-y-1.5">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button size="sm" variant="soft" onClick={() => fileRef.current?.click()}>Загрузить фото</Button>
          {photo && <button onClick={() => { tap(); setPhoto(null); }} className="block text-[12px] font-semibold text-[var(--muted)]">{tgPhoto ? "Вернуть фото из Telegram" : "Убрать фото"}</button>}
          {!photo && tgPhoto && <p className="text-[11px] text-[var(--muted-2)]">Сейчас — фото из Telegram</p>}
        </div>
      </div>

      <Field label="Имя и фамилия"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>

      {/* Запросы */}
      <div>
        <p className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">С какими запросами работаю</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {shown.map((t) => {
            const on = topics.includes(t);
            return (
              <button key={t} onClick={() => toggleTopic(t)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold transition-transform active:scale-95 stroke" style={on ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", color: "var(--muted)" }}>
                {on && <Icon name="check" width={12} weight="regular" color="#fff" />}
                {t}
              </button>
            );
          })}
          <button onClick={() => setTopicsOpen(!topicsOpen)} className="rounded-full px-2.5 py-1 text-[12px] font-bold text-[var(--muted)]">{topicsOpen ? "свернуть" : "ещё…"}</button>
        </div>
        <div className="flex gap-2">
          <Input value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }} placeholder="Добавить свой запрос" />
          <Button size="sm" variant="soft" onClick={addManual}>+</Button>
        </div>
      </div>

      <Field label="Работаю в подходе"><Input value={approach} onChange={(e) => setApproach(e.target.value)} placeholder="КПТ, ACT, гештальт…" /></Field>

      {/* Образование — список с «Добавить» */}
      <div>
        <p className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">Образование</p>
        <div className="space-y-2">
          {education.map((e, i) => (
            <div key={i} className="flex gap-2">
              <Input value={e} onChange={(ev) => setEdu(i, ev.target.value)} placeholder="Вуз, специализация, год" />
              <button onClick={() => rmEdu(i)} className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-[12px] stroke bg-white text-[var(--muted)]">✕</button>
            </div>
          ))}
          <button onClick={addEdu} className="flex w-full items-center justify-center gap-1.5 rounded-[12px] py-2 text-[13px] font-bold stroke bg-white active:scale-[0.99] transition-transform">
            <Icon name="plus" width={15} weight="regular" /> Добавить
          </button>
        </div>
      </div>

      <Field label="Опыт, лет"><Input value={years} onChange={(e) => setYears(e.target.value)} inputMode="numeric" placeholder="5" /></Field>
      <Field label="О себе"><Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="Пара предложений о вашей практике" /></Field>

      <div className="flex gap-2">
        <Button variant="soft" size="sm" onClick={onDone}>Отмена</Button>
        <Button className="flex-1" onClick={save}>Сохранить профиль</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
