"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { ClientAvatar } from "@/components/client-avatar";
import { useConfirmAsk } from "@/components/confirm-ask";
import { ClientPicker } from "@/components/groups-dashboard";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { KIND_LABEL, activeMembers, addMembers, deleteGroup, getGroup, removeMember, seatsLeft } from "@/lib/groups";
import { tap } from "@/lib/haptics";

const EDGE = "var(--salmon-edge)";
const SOFT = "var(--salmon-soft)";

export function GroupDetail() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = Number(search.get("id") ?? params.id);
  const { ask, askNode } = useConfirmAsk();
  const [picking, setPicking] = useState(false);

  const group = useQuery({ queryKey: ["group", id], queryFn: () => getGroup(id), enabled: Number.isFinite(id) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["group", id] });
    void qc.invalidateQueries({ queryKey: ["groups"] });
  };

  const add = useMutation({
    mutationFn: (clientIds: number[]) => addMembers(id, clientIds),
    onSuccess: () => { refresh(); setPicking(false); },
  });
  const remove = useMutation({ mutationFn: (memberId: number) => removeMember(id, memberId), onSuccess: refresh });
  const drop = useMutation({
    mutationFn: () => deleteGroup(id),
    onSuccess: () => { refresh(); router.push("/groups"); },
  });

  const g = group.data;
  const members = g ? activeMembers(g) : [];

  return (
    <div>
      <PageHead title={g?.title ?? "Группа"} icon="users" back="/groups" sub={g ? KIND_LABEL[g.kind] : undefined} />
      <Reveal y={10}>
        <div className="-mx-4 min-h-[64vh] rounded-t-[27px] px-4 pb-8 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>
          {!g ? null : (
            <>
              <div className="flex items-center justify-between rounded-[17px] bg-white p-3" style={{ border: `var(--bw) solid ${EDGE}` }}>
                <span>
                  <span className="block font-tight text-[17px] font-black leading-tight">{members.length} из {g.capacity}</span>
                  <span className="block text-[11px] font-bold text-[var(--muted)]">
                    {seatsLeft(g) ? `свободно ${seatsLeft(g)}` : "мест не осталось"}
                  </span>
                </span>
                <button
                  onClick={() => { tap(); setPicking(true); }}
                  disabled={!seatsLeft(g)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-black text-white disabled:opacity-45"
                  style={{ background: EDGE }}
                >
                  <Icon name="plus" width={13} weight="bold" color="#fff" /> Добавить
                </button>
              </div>

              <p className="mb-2 mt-6 text-[12px] font-black uppercase tracking-[.08em] text-[var(--muted)]">Состав</p>
              {members.length ? (
                <div className="flex flex-col gap-1.5">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5 rounded-[13px] bg-white p-2.5" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
                      <ClientAvatar name={m.name} photo={m.photo} className="keep-style h-9 w-9 rounded-full text-[12px] font-black" style={{ background: SOFT, color: EDGE }} />
                      <span className="min-w-0 flex-1 text-[13px] font-black">{m.name}</span>
                      <button
                        onClick={() => ask({
                          title: "Убрать из группы?",
                          note: `${m.name} перестанет числиться в составе. Посещаемость прошлых встреч останется.`,
                          confirm: "Убрать",
                          tone: "danger",
                          run: () => remove.mutate(m.id),
                        })}
                        className="ico h-8 w-8 keep-style"
                        style={{ background: "var(--surface-2)" }}
                        aria-label={`Убрать ${m.name}`}
                      >
                        <Icon name="close" width={13} weight="bold" color="var(--muted)" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-[13px] bg-white p-4 text-center text-[12px] font-semibold text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>
                  Состав пуст — добавьте участников из своих клиентов.
                </p>
              )}

              <button
                onClick={() => ask({
                  title: "Удалить группу?",
                  note: `«${g.title}» исчезнет вместе с составом. Карточки клиентов останутся на месте.`,
                  confirm: "Удалить",
                  tone: "danger",
                  run: () => drop.mutate(),
                })}
                className="mt-6 w-full py-3 text-[12px] font-black"
                style={{ color: "var(--coral-edge)" }}
              >
                Удалить группу
              </button>
            </>
          )}
        </div>
      </Reveal>

      {picking && g && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center @md:items-center">
          <button className="absolute inset-0 bg-[rgba(32,28,24,.5)]" onClick={() => setPicking(false)} aria-label="Закрыть" />
          <section role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-t-[28px] bg-[var(--surface)] p-4 @md:rounded-[28px]">
            <h2 className="mb-3 font-tight text-[18px] font-black">Кого добавить</h2>
            <ClientPicker
              exclude={new Set(members.map((m) => m.clientId).filter((x): x is number => x !== null))}
              onPick={(ids) => add.mutate(ids)}
              busy={add.isPending}
            />
          </section>
        </div>
      )}

      {askNode}
    </div>
  );
}
