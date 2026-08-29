"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ClientAvatar } from "@/components/client-avatar";
import { Icon } from "@/components/icons";
import { Input } from "@/components/ui";
import { addClientByNick, listTgContacts, requestContactPick, type TgContact } from "@/lib/clients";
import { DEMO } from "@/lib/demo";
import { success, tap } from "@/lib/haptics";
import { BOT_NAME } from "@/lib/brand";
import { openTelegramLink } from "@/lib/telegram";

/**
 * Добавление клиента из контактов Telegram.
 *
 * Смысл в том, чтобы завести карточку без всякой синхронизации: специалисту
 * нужны лицо, имя и ник для быстрого сообщения, а подключать свой профиль
 * клиент будет только если сам захочет — приглашение живёт в карточке.
 *
 * Список контактов приложению Telegram не отдаёт, такого API нет. Нативный
 * выбор человека возможен один — кнопка в чате бота, поэтому в бою уходим
 * туда. В демо тот же выбор рисуем сами: путь должен быть проходим целиком.
 */
export function ContactPicker({ onAdded }: { onAdded: (id: number) => void }) {
  const qc = useQueryClient();
  const [nick, setNick] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (username: string) => addClientByNick(username),
    onSuccess: (c) => {
      success();
      setNick("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["clients"] });
      onAdded(c.id);
    },
    onError: (e: Error) => setError(/402/.test(e.message) ? "Места на бесплатном тарифе закончились." : "Не получилось добавить. Попробуйте ещё раз."),
  });

  return (
    <div className="card-plain p-3">
      <div className="flex items-center gap-2">
        <span className="ico ico-accent h-8 w-8"><Icon name="telegram" width={15} weight="fill" color="#fff" /></span>
        <p className="text-[13px] font-black leading-none">Из контактов Telegram</p>
      </div>
      <p className="t-cap mt-1.5 leading-snug">
        Карточка появится с именем и фото, чтобы вы могли написать в один тап. Подключать профиль клиенту не нужно — предложите позже, из самой карточки.
      </p>

      {DEMO ? <DemoContacts pending={add.isPending} onPick={(c) => add.mutate(c.username)} /> : <NativePick />}

      <form
        onSubmit={(e) => { e.preventDefault(); const value = nick.trim(); if (value) add.mutate(value); }}
        className="mt-2 flex items-center gap-2"
      >
        <Input
          className="[caret-color:var(--ink)] flex-1"
          value={nick}
          onChange={(e) => { setNick(e.target.value); setError(null); }}
          placeholder="Или ник: @nickname"
          enterKeyHint="done"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button type="submit" disabled={add.isPending || !nick.trim()} className="btn shrink-0 px-3.5 py-2.5 text-[12px] disabled:opacity-50">
          Добавить
        </button>
      </form>
      {error && <p className="mt-1.5 text-[11.5px] font-bold" style={{ color: "var(--salmon-edge)" }}>{error}</p>}
    </div>
  );
}

/** Бой: кнопка уводит в чат бота, где Telegram сам показывает список контактов. */
function NativePick() {
  const [sent, setSent] = useState(false);
  const ask = useMutation({
    mutationFn: requestContactPick,
    onSuccess: () => { success(); setSent(true); openTelegramLink(`https://t.me/${BOT_NAME}`); },
  });
  return (
    <div className="mt-2.5">
      <button onClick={() => { tap(); ask.mutate(); }} disabled={ask.isPending} className="btn w-full py-2.5 disabled:opacity-50">
        <Icon name="users" width={15} weight="bold" color="#fff" /> Выбрать из контактов
      </button>
      {sent && <p className="t-cap mt-1.5 leading-snug">Выбор открылся в чате с ботом: отметьте людей — карточки заведутся сами.</p>}
      {ask.isError && <p className="mt-1.5 text-[11.5px] font-bold" style={{ color: "var(--salmon-edge)" }}>Не получилось открыть выбор. Добавьте по нику.</p>}
    </div>
  );
}

/** Демо: тот же выбор своим списком — нативного тут нет. */
function DemoContacts({ pending, onPick }: { pending: boolean; onPick: (c: TgContact) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: contacts = [], isLoading } = useQuery({ queryKey: ["tg-contacts"], queryFn: listTgContacts, enabled: open });
  const list = contacts.filter((c) => `${c.name} ${c.username}`.toLowerCase().includes(q.trim().toLowerCase()));

  if (!open) {
    return (
      <button onClick={() => { tap(); setOpen(true); }} className="btn mt-2.5 w-full py-2.5">
        <Icon name="users" width={15} weight="bold" color="#fff" /> Выбрать из контактов
      </button>
    );
  }

  return (
    <div className="mt-2.5">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по контактам" />
      <div className="mt-2 max-h-[248px] space-y-1 overflow-y-auto">
        {isLoading && <p className="t-cap py-2">Загружаем контакты…</p>}
        {!isLoading && !list.length && <p className="t-cap py-2">Никого не нашлось.</p>}
        {list.map((c) => (
          <button
            key={c.username}
            onClick={() => { tap(); onPick(c); }}
            disabled={pending}
            className="stroke flex w-full items-center gap-2.5 rounded-[12px] bg-white p-2 text-left disabled:opacity-50"
          >
            <ClientAvatar name={c.name} photo={c.photo} className="h-9 w-9 shrink-0 rounded-full text-[13px] font-black" style={{ background: "var(--alt-soft)", color: "var(--ink)" }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-black leading-tight">{c.name}</span>
              <span className="block truncate text-[11px] font-semibold text-[var(--muted)]">@{c.username}</span>
            </span>
            <Icon name="plus" width={15} weight="bold" color="var(--edge)" />
          </button>
        ))}
      </div>
    </div>
  );
}
