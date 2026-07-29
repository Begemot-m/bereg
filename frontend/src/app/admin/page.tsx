"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Input, SkeletonRow } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { tap } from "@/lib/haptics";

type Stats = {
  users: { total: number; newWeek: number; psychologists: number; blocked: number; activeWeek: number };
  subscriptions: { paid: number; granted: number; pending: number };
  usage: { clients: number; appointments: number; appointmentsMonth: number };
  support: { open: number };
};

type Row = {
  id: number; name: string; username: string | null; email: string | null;
  role: string; isAdmin: boolean; blocked: boolean; deleted: boolean;
  createdAt: string; pro: boolean; proUntil: string | null; proGranted: boolean;
  clients: number; appointments: number;
};

const dateF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "2-digit" });

export default function AdminPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const qc = useQueryClient();

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => apiFetch<Stats>("/admin/stats") });
  const users = useQuery({
    queryKey: ["admin-users", q, page],
    queryFn: () => apiFetch<{ items: Row[]; total: number; pages: number }>(`/admin/users?q=${encodeURIComponent(q)}&page=${page}`),
  });

  const act = useMutation({
    mutationFn: ({ id, body }: { id: number; body: unknown }) =>
      apiFetch(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
  });

  // 403 приходит всем, кто не админ: страницу просто не показываем.
  if (users.isError || stats.isError) {
    return <div className="py-16 text-center"><p className="t-head">Доступ только для администратора</p></div>;
  }

  return (
    <div>
      <PageHead title="Админка" sub="Платформа целиком" icon="gear" />

      <div className="sheet space-y-6">
        {/* Сводка */}
        {stats.isLoading ? <SkeletonRow /> : stats.data && (
          <section>
            <p className="t-micro mb-2">Люди</p>
            <div className="grid grid-cols-3 gap-2">
              <Tile value={stats.data.users.total} label="всего" />
              <Tile value={stats.data.users.activeWeek} label="активны за неделю" />
              <Tile value={stats.data.users.newWeek} label="новых за неделю" />
            </div>

            <p className="t-micro mb-2 mt-4">Подписки</p>
            <div className="grid grid-cols-3 gap-2">
              <Tile value={stats.data.subscriptions.paid} label="оплачено" />
              <Tile value={stats.data.subscriptions.granted} label="выдано вручную" />
              <Tile value={stats.data.subscriptions.pending} label="ждут оплаты" />
            </div>

            <p className="t-micro mb-2 mt-4">Работа</p>
            <div className="grid grid-cols-3 gap-2">
              <Tile value={stats.data.usage.clients} label="карточек" />
              <Tile value={stats.data.usage.appointmentsMonth} label="сессий за месяц" />
              <Tile value={stats.data.support.open} label="обращений" />
            </div>
          </section>
        )}

        {/* Пользователи */}
        <section>
          <p className="t-micro mb-2">Пользователи</p>
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Имя, ник или почта"
          />

          <div className="mt-3 space-y-2">
            {users.isLoading && <SkeletonRow />}
            {users.data?.items.map((u) => (
              <div key={u.id} className="card p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="t-head truncate">
                      {u.name}
                      {u.isAdmin && <span className="chip chip-strong ml-1.5 uppercase">админ</span>}
                    </p>
                    <p className="t-cap mt-0.5 truncate">
                      {u.username ? `@${u.username}` : "без ника"} · {u.email ?? "без почты"} · с {dateF.format(new Date(u.createdAt))}
                    </p>
                    <p className="t-cap mt-0.5">
                      {u.clients} клиентов · {u.appointments} сессий
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {u.pro && (
                      <span className="chip" style={u.proGranted ? { background: "var(--amber-soft)" } : { background: "var(--green-soft)" }}>
                        {u.proGranted ? "PRO вручную" : "PRO"}
                      </span>
                    )}
                    {u.blocked && <span className="chip" style={{ background: "var(--salmon-soft)" }}>заблокирован</span>}
                  </div>
                </div>

                {u.proUntil && <p className="t-cap mt-1">PRO до {dateF.format(new Date(u.proUntil))}</p>}

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button onClick={() => { tap(); act.mutate({ id: u.id, body: { grantPro: { days: 30, note: "выдано из админки" } } }); }} className="btn btn-accent px-3 py-1.5 text-[11px]">
                    +30 дней PRO
                  </button>
                  <button onClick={() => { tap(); act.mutate({ id: u.id, body: { grantPro: { days: 365, note: "год из админки" } } }); }} className="btn btn-white px-3 py-1.5 text-[11px]">
                    +год
                  </button>
                  {u.pro && (
                    <button onClick={() => { if (confirm(`Снять PRO у ${u.name}?`)) act.mutate({ id: u.id, body: { revokePro: true } }); }} className="btn btn-white px-3 py-1.5 text-[11px]">
                      снять PRO
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm(u.blocked ? `Разблокировать ${u.name}?` : `Заблокировать ${u.name}? Он выйдет из всех сессий.`)) act.mutate({ id: u.id, body: { blocked: !u.blocked } }); }}
                    className="btn ml-auto px-3 py-1.5 text-[11px]"
                    style={u.blocked ? undefined : { background: "var(--danger)", borderColor: "var(--danger)" }}
                  >
                    {u.blocked ? "разблокировать" : "заблокировать"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {(users.data?.pages ?? 0) > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn btn-white px-3 py-1.5 text-[12px] disabled:opacity-40">Назад</button>
              <span className="t-cap">{page + 1} из {users.data?.pages}</span>
              <button disabled={page + 1 >= (users.data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)} className="btn btn-white px-3 py-1.5 text-[12px] disabled:opacity-40">Дальше</button>
            </div>
          )}
        </section>

        <p className="t-cap">
          <Icon name="lock" width={12} weight="bold" className="mr-1 inline" />
          Права администратора выдаются только в базе. Каждое действие здесь пишется в аудит.
        </p>
      </div>
    </div>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="card-soft p-2.5">
      <p className="font-tight tabular-nums text-[24px] font-black leading-none">{value}</p>
      <p className="t-cap mt-1 leading-tight">{label}</p>
    </div>
  );
}
