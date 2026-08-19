"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ArrowGlyph, StatTile } from "@/components/blocks";
import { ClientAvatar } from "@/components/client-avatar";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { listClients } from "@/lib/clients";
import { KIND_LABEL, activeMembers, createGroup, listGroups, seatsLeft, type Group, type GroupKind } from "@/lib/groups";
import { tap } from "@/lib/haptics";

const EDGE = "var(--salmon-edge)";
const SOFT = "var(--salmon-soft)";

/** Лица состава стопкой: до четырёх, дальше счётчик. */
export function MemberStack({ group, size = 30 }: { group: Group; size?: number }) {
  const members = activeMembers(group);
  const shown = members.slice(0, 4);
  const rest = members.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((m, i) => (
        <ClientAvatar
          key={m.id}
          name={m.name}
          photo={m.photo}
          className="keep-style rounded-full text-[11px] font-black"
          style={{ width: size, height: size, marginLeft: i ? -8 : 0, background: SOFT, color: EDGE, border: "2px solid #fff" }}
        />
      ))}
      {rest > 0 && (
        <span className="keep-style flex items-center justify-center rounded-full text-[10px] font-black" style={{ width: size, height: size, marginLeft: -8, background: EDGE, color: "#fff", border: "2px solid #fff" }}>
          +{rest}
        </span>
      )}
      {!members.length && <span className="text-[11px] font-bold text-[var(--muted-2)]">состав пуст</span>}
    </span>
  );
}

export function GroupsDashboard() {
  const groups = useQuery({ queryKey: ["groups"], queryFn: listGroups });
  const [adding, setAdding] = useState(false);

  const list = groups.data ?? [];
  const people = list.reduce((n, g) => n + activeMembers(g).length, 0);
  const pairs = list.filter((g) => g.kind === "pair").length;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Групп" value={String(list.length - pairs)} accent />
        <StatTile label="Пар" value={String(pairs)} />
        <StatTile label="Участников" value={String(people)} />
      </div>

      <div className="mb-2 mt-6 flex items-center justify-between gap-2">
        <p className="text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Мои группы</p>
        <button onClick={() => { tap(); setAdding(true); }} className="flex items-center gap-1 text-[12px] font-black" style={{ color: EDGE }}>
          <Icon name="plus" width={13} weight="bold" color={EDGE} /> Создать
        </button>
      </div>

      {groups.isPending ? null : list.length ? (
        <div className="flex flex-col gap-2.5">
          {list.map((g, i) => (
            <Reveal key={g.id} delay={0.03 + i * 0.04}>
              <GroupRow group={g} />
            </Reveal>
          ))}
        </div>
      ) : (
        <EmptyGroups onAdd={() => setAdding(true)} />
      )}

      <NewGroupSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function GroupRow({ group }: { group: Group }) {
  const left = seatsLeft(group);
  return (
    <Link
      href={`/groups/${group.id}`}
      onClick={() => tap()}
      className="flex items-center gap-3 rounded-[17px] bg-white p-3 transition-transform duration-200 active:scale-[.98]"
      style={{ border: `var(--bw) solid ${EDGE}` }}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-tight text-[15px] font-black leading-tight">{group.title}</span>
          <span className="chip keep-style" style={{ background: SOFT, color: EDGE }}>{KIND_LABEL[group.kind]}</span>
        </span>
        <span className="mt-2 flex items-center gap-2">
          <MemberStack group={group} />
          <span className="text-[11px] font-bold text-[var(--muted)]">
            {activeMembers(group).length} из {group.capacity}
            {left > 0 && group.kind === "group" ? ` · свободно ${left}` : ""}
          </span>
        </span>
      </span>
      <ArrowGlyph size={13} />
    </Link>
  );
}

function EmptyGroups({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-[19px] bg-white p-5 text-center" style={{ border: `var(--bw) solid ${EDGE}` }}>
      <span className="ico mx-auto h-12 w-12 keep-style" style={{ background: SOFT }}>
        <Icon name="users" width={23} weight="bold" color={EDGE} />
      </span>
      <h2 className="mt-3 font-tight text-[18px] font-black leading-tight">Пока ни одной группы</h2>
      <p className="mx-auto mt-1 max-w-[280px] text-[12px] font-semibold leading-snug text-[var(--muted)]">
        Заведите группу или пару — состав соберётся из ваших клиентов.
      </p>
      <button onClick={() => { tap(); onAdd(); }} className="btn mt-4 w-full py-3">Создать группу</button>
    </div>
  );
}

function NewGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<GroupKind>("group");
  const [capacity, setCapacity] = useState(8);

  const create = useMutation({
    mutationFn: () => createGroup({ title: title.trim(), kind, capacity }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["groups"] });
      setTitle("");
      setKind("group");
      setCapacity(8);
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center @md:items-center">
      <button className="absolute inset-0 bg-[rgba(32,28,24,.5)]" onClick={onClose} aria-label="Закрыть" />
      <section role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-t-[28px] bg-[var(--surface)] p-4 @md:rounded-[28px]">
        <h2 className="font-tight text-[18px] font-black">Новая группа</h2>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["group", "pair"] as GroupKind[]).map((k) => (
            <button
              key={k}
              onClick={() => { tap(); setKind(k); setCapacity(k === "pair" ? 2 : 8); }}
              className="rounded-[13px] py-2.5 text-[13px] font-black"
              style={kind === k ? { background: EDGE, color: "#fff" } : { background: "#fff", color: "var(--ink)", border: "var(--bw) solid var(--edge-neutral)" }}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Название</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "pair" ? "Марина и Дмитрий" : "Группа поддержки"}
            className="tf mt-1 w-full"
            maxLength={120}
          />
        </label>

        {kind === "group" && (
          <div className="mt-3 flex items-center justify-between rounded-[13px] bg-white px-3 py-2.5" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
            <span className="text-[13px] font-bold">Мест в группе</span>
            <span className="flex items-center gap-3">
              <button onClick={() => { tap(); setCapacity((n) => Math.max(2, n - 1)); }} className="ico h-8 w-8 keep-style" style={{ background: SOFT }} aria-label="Меньше">
                <Icon name="close" width={13} weight="bold" color={EDGE} />
              </button>
              <span className="w-6 text-center text-[15px] font-black">{capacity}</span>
              <button onClick={() => { tap(); setCapacity((n) => Math.min(40, n + 1)); }} className="ico h-8 w-8 keep-style" style={{ background: SOFT }} aria-label="Больше">
                <Icon name="plus" width={13} weight="bold" color={EDGE} />
              </button>
            </span>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={() => { tap(); onClose(); }} className="btn btn-white flex-1 py-2.5">Отмена</button>
          <button onClick={() => { tap(); create.mutate(); }} disabled={!title.trim() || create.isPending} className="btn flex-1 py-2.5">
            Создать
          </button>
        </div>
      </section>
    </div>
  );
}

/** Список клиентов с отметками — им добирается состав группы. */
export function ClientPicker({ exclude, onPick, busy }: { exclude: Set<number>; onPick: (ids: number[]) => void; busy?: boolean }) {
  const clients = useQuery({ queryKey: ["clients"], queryFn: () => listClients() });
  const [picked, setPicked] = useState<number[]>([]);
  const free = (clients.data ?? []).filter((c) => !exclude.has(c.id));

  if (!free.length) {
    return <p className="py-4 text-center text-[12px] font-semibold text-[var(--muted)]">Все ваши клиенты уже в этой группе.</p>;
  }

  return (
    <>
      <div className="flex max-h-[46dvh] flex-col gap-1.5 overflow-y-auto">
        {free.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => { tap(); setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id])); }}
              className="flex items-center gap-2.5 rounded-[13px] bg-white p-2.5 text-left"
              style={{ border: `var(--bw) solid ${on ? EDGE : "var(--edge-neutral)"}` }}
            >
              <ClientAvatar name={c.name} photo={c.photo} className="keep-style h-9 w-9 rounded-full text-[12px] font-black" style={{ background: SOFT, color: EDGE }} />
              <span className="min-w-0 flex-1 text-[13px] font-black">{c.name}</span>
              <span className="ico h-6 w-6 keep-style" style={{ background: on ? EDGE : "var(--surface-2)" }}>
                {on && <Icon name="check" width={12} weight="bold" color="#fff" />}
              </span>
            </button>
          );
        })}
      </div>
      <button onClick={() => { tap(); onPick(picked); }} disabled={!picked.length || busy} className="btn mt-3 w-full py-2.5">
        Добавить{picked.length ? ` · ${picked.length}` : ""}
      </button>
    </>
  );
}
