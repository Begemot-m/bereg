"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button, Card, Textarea } from "@/components/ui";
import { select, tap } from "@/lib/haptics";
import { sendSupport } from "@/lib/support";

const TG_PHONE = "+79117230099";
const TG_LINK = `https://t.me/${TG_PHONE}`;
const PHONE_PRETTY = "+7 911 723-00-99";

export function CareModule() {
  const [kind, setKind] = useState("Вопрос");
  const [text, setText] = useState("");
  const send = useMutation({ mutationFn: () => sendSupport(kind, text.trim()), onSuccess: () => setText("") });

  return (
    <Card className="space-y-3">
      {/* Быстрый переход в Telegram */}
      <div className="flex items-center gap-3 rounded-[16px] p-3" style={{ background: "var(--head-soft)", border: "var(--bw) solid var(--edge)" }}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white" style={{ border: "var(--bw) solid var(--edge)" }}><Icon name="spark" width={20} weight="fill" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black leading-tight">Напишите нам в Telegram</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">Отвечаем живо · {PHONE_PRETTY}</p>
        </div>
      </div>
      <a href={TG_LINK} target="_blank" rel="noopener noreferrer" onClick={() => tap()} className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--ink)] py-3 text-[14px] font-black text-white transition-transform active:scale-[0.98]">
        <Icon name="spark" width={16} weight="fill" /> Открыть чат в Telegram
      </a>

      {/* Или сообщение здесь */}
      <div className="flex items-center gap-2 pt-1"><span className="h-px flex-1" style={{ background: "var(--edge-neutral)" }} /><span className="text-[10px] font-black uppercase tracking-[.08em] text-[var(--muted-2)]">или оставьте здесь</span><span className="h-px flex-1" style={{ background: "var(--edge-neutral)" }} /></div>
      <div className="flex gap-1.5">
        {["Вопрос", "Жалоба", "Идея"].map((k) => (
          <button key={k} onClick={() => { select(); setKind(k); }} className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors duration-200 ${kind === k ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>{k}</button>
        ))}
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Вопрос, жалоба или идея нового инструмента…" />
      {send.isSuccess ? (
        <p className="text-[13px] font-semibold text-[var(--good)]">Спасибо! Обращение отправлено.</p>
      ) : (
        <div className="flex justify-end"><Button size="sm" disabled={send.isPending || !text.trim()} onClick={() => send.mutate()} arrow>Отправить</Button></div>
      )}
    </Card>
  );
}
