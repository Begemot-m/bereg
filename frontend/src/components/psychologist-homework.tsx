"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Arrow, ArrowGlyph } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Textarea } from "@/components/ui";
import { deleteHomework, HW_LABEL, sendHomework, updateHomework, type Homework, type HwStatus } from "@/lib/clients";
import { success, tap } from "@/lib/haptics";

const dtf = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
// Раздел заданий целиком в лавандовом тоне: статус различается словом на
// плашке, а не цветом — иначе список пестрит тремя цветами разом.
const HW_TONE: Record<HwStatus, string> = { assigned: "purple", doing: "purple", done: "purple" };

export function PsychologistHomeworkPreview({ items, href }: { items: Homework[]; href: string }) {
  const active = items.find((item) => item.status !== "done");
  return <div className="card-soft p-3"><Link href={href} onClick={tap} className="card-plain flex items-center gap-3 p-3"><span className="ico ico-accent h-11 w-11 shrink-0"><Icon name="book" width={20} weight="bold" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="t-head">Задания</p>{active && <span className="chip chip-strong">Активное</span>}</div><p className="t-cap mt-1 line-clamp-2">{active?.text ?? "Открыть страницу заданий"}</p></div><Arrow /></Link></div>;
}

export function PsychologistHomeworkDetail({ clientId, items, onChanged }: { clientId: number; items: Homework[]; onChanged: () => void }) {
  const [text, setText] = useState("");
  const send = useMutation({ mutationFn: () => sendHomework(clientId, text.trim()), onSuccess: () => { success(); setText(""); onChanged(); } });
  const active = items.filter((item) => item.status !== "done");
  const done = items.filter((item) => item.status === "done");
  return <div className="space-y-4"><section className="card-soft p-3"><div className="card-plain p-3"><div className="mb-2 flex items-center gap-2"><span className="ico ico-accent h-9 w-9"><Icon name="note" width={17} weight="bold" /></span><div><p className="t-head">Новое задание</p><p className="t-cap">Клиент увидит его в своей терапии</p></div></div><Textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="Например: дневник тревоги — 3 записи за неделю" /><button disabled={send.isPending || !text.trim()} onClick={() => send.mutate()} className="btn btn-accent mt-2 w-full py-2">Отправить <ArrowGlyph /></button></div></section><HomeworkSection title="Активные" items={active} onChanged={onChanged} empty="Активных заданий нет." />{done.length > 0 && <HomeworkSection title="История" items={done} onChanged={onChanged} />}</div>;
}

function HomeworkSection({ title, items, onChanged, empty }: { title: string; items: Homework[]; onChanged: () => void; empty?: string }) {
  return <section><div className="mb-3 flex items-center justify-between"><h2 className="t-head">{title}</h2><span className="chip">{items.length}</span></div><div className="space-y-2">{items.length ? items.map((item) => <HomeworkRow key={item.id} hw={item} onChanged={onChanged} />) : <div className="card-soft p-4"><p className="t-cap">{empty}</p></div>}</div></section>;
}

function HomeworkRow({ hw, onChanged }: { hw: Homework; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(hw.text);
  const tone = HW_TONE[hw.status];
  const save = useMutation({ mutationFn: () => updateHomework(hw.id, { text: text.trim() }), onSuccess: () => { setEditing(false); onChanged(); } });
  const del = useMutation({ mutationFn: () => deleteHomework(hw.id), onSuccess: onChanged });
  return <div className="card p-3">{editing ? <div className="space-y-2"><Textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} autoFocus /><div className="flex gap-2"><button disabled={!text.trim() || save.isPending} onClick={() => save.mutate()} className="btn btn-accent px-3 py-2">Сохранить</button><button onClick={() => { setEditing(false); setText(hw.text); }} className="btn btn-white px-3 py-2">Отмена</button></div></div> : <><div className="flex items-start gap-3"><span className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${tone})` }} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="t-head">Домашнее задание</p><span className="chip" style={{ background: `var(--${tone}-soft)` }}>{HW_LABEL[hw.status]}</span></div><p className="t-body mt-1">{hw.text}</p><p className="t-cap mt-2">{dtf.format(new Date(hw.sentAt))}</p></div></div><div className="mt-3 flex gap-2"><button onClick={() => { tap(); setEditing(true); }} className="btn btn-accent flex-1 py-2">Редактировать</button><button onClick={() => { if (confirm("Удалить задание?")) del.mutate(); }} className="btn btn-white px-3 py-2">Удалить</button></div></>}</div>;
}
