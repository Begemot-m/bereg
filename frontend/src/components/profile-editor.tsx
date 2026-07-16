"use client";

import { useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Button, Input, Textarea } from "@/components/ui";
import { select, success, tap } from "@/lib/haptics";
import { displayName, displayPhoto, getPsyProfile, savePsyProfile, tgUser } from "@/lib/profile";

const SUGGESTED = ["тревога", "депрессия", "выгорание", "отношения", "границы", "самооценка", "травма", "утрата", "зависимости", "панические атаки", "стресс", "сон", "прокрастинация", "одиночество"];

export function ProfileEditor({ onSaved }: { onSaved?: () => void }) {
  const cur = getPsyProfile();
  const [name, setName] = useState(cur?.name || displayName());
  const [approach, setApproach] = useState(cur?.approach || "");
  const [education, setEducation] = useState(cur?.education || "");
  const [about, setAbout] = useState(cur?.about || "");
  const [years, setYears] = useState(cur?.experienceYears || "");
  const [topics, setTopics] = useState<string[]>(cur?.topics || []);
  const [photo, setPhoto] = useState<string | null>(cur?.photo ?? null);
  const [manual, setManual] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const shownPhoto = photo || displayPhoto();
  const tgPhoto = tgUser()?.photo_url ?? null;

  const toggleTopic = (t: string) => {
    select();
    setTopics((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };
  const addManual = () => {
    const v = manual.trim().toLowerCase();
    if (v && !topics.includes(v)) { tap(); setTopics([...topics, v]); }
    setManual("");
  };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setPhoto(String(reader.result)); tap(); };
    reader.readAsDataURL(f);
  };
  const save = () => {
    savePsyProfile({ name: name.trim(), approach: approach.trim(), education: education.trim(), about: about.trim(), experienceYears: years.trim(), topics, photo });
    success();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      {/* Фото */}
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl" style={{ background: "var(--a-tint)" }}>
          {shownPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownPhoto} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold" style={{ color: "var(--a1)" }}>{(name || "П").charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="space-y-1.5">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button size="sm" variant="soft" onClick={() => fileRef.current?.click()}>Загрузить фото</Button>
          {photo && (
            <button onClick={() => { tap(); setPhoto(null); }} className="block text-[12px] font-semibold text-[var(--muted)]">
              {tgPhoto ? "Вернуть фото из Telegram" : "Убрать фото"}
            </button>
          )}
          {!photo && tgPhoto && <p className="text-[11px] text-[var(--muted-2)]">Сейчас — фото из Telegram</p>}
        </div>
      </div>

      <Field label="Имя и фамилия"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>

      {/* Запросы: облако + ручной ввод */}
      <div>
        <p className="mb-1.5 text-[12px] font-bold text-[var(--muted)]">С какими запросами работаю</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[...new Set([...topics, ...SUGGESTED])].map((t) => {
            const on = topics.includes(t);
            return (
              <button key={t} onClick={() => toggleTopic(t)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors duration-150" style={{ background: on ? "var(--a1)" : "var(--surface-2)", color: on ? "#fff" : "var(--muted)" }}>
                {on && <Icon name="check" width={12} weight="bold" color="#fff" />}
                {t}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }} placeholder="Добавить свой запрос" />
          <Button size="sm" variant="soft" onClick={addManual}>+</Button>
        </div>
      </div>

      <Field label="Работаю в подходе"><Input value={approach} onChange={(e) => setApproach(e.target.value)} placeholder="КПТ, ACT, гештальт…" /></Field>
      <Field label="Образование"><Textarea value={education} onChange={(e) => setEducation(e.target.value)} rows={2} placeholder="Вуз, специализация, переподготовка" /></Field>
      <Field label="Опыт, лет"><Input value={years} onChange={(e) => setYears(e.target.value)} inputMode="numeric" placeholder="5" /></Field>
      <Field label="О себе"><Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="Пара предложений о вашей практике" /></Field>

      <Button className="w-full" onClick={save}>{saved ? "Сохранено" : "Сохранить профиль"}</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
