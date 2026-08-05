"use client";

import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Input, SkeletonRow } from "@/components/ui";
import {
  useAdminStats, useAdminUsers, useUserAction,
  useReviewVerification, useVerificationQueue,
  type PsyApplication,
} from "@/lib/admin";
import { tap } from "@/lib/haptics";

const dateF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "2-digit" });

export default function AdminPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const stats = useAdminStats();
  const users = useAdminUsers(q, page);
  const act = useUserAction();
  const verification = useVerificationQueue();
  const review = useReviewVerification();

  // 403 приходит всем, кто не админ: страницу просто не показываем.
  if (users.isError || stats.isError) {
    return <div className="py-16 text-center"><p className="t-head">Доступ только для администратора</p></div>;
  }

  return (
    <div>
      <PageHead title="Админка" sub="Платформа целиком" icon="gear" />

      <div className="sheet space-y-6">
        {/* Верификация — первое, что должен видеть владелец: пока анкета висит,
            психолог не в каталоге и не может брать клиентов. */}
        <section>
          <p className="t-micro mb-2">
            Анкеты на проверке
            {(verification.data?.queue.length ?? 0) > 0 && (
              <span className="chip chip-strong ml-1.5">{verification.data?.queue.length}</span>
            )}
          </p>

          {verification.isLoading && <SkeletonRow />}
          {verification.data?.queue.length === 0 && (
            <p className="t-cap">Разобрано. Новые заявки появятся здесь.</p>
          )}

          <div className="space-y-2">
            {verification.data?.queue.map((a) => (
              <Application
                key={a.userId}
                a={a}
                busy={review.isPending}
                onApprove={() => { tap(); review.mutate({ userId: a.userId }); }}
                onReject={() => {
                  const reason = prompt(`Что переделать ${a.name}? Причина уйдёт ему в уведомление.`)?.trim();
                  if (reason && reason.length >= 5) review.mutate({ userId: a.userId, reason });
                }}
              />
            ))}
          </div>

          {(verification.data?.recent.length ?? 0) > 0 && (
            <details className="mt-2">
              <summary className="t-cap cursor-pointer">Недавно рассмотренные</summary>
              <div className="mt-2 space-y-1">
                {verification.data?.recent.map((a) => (
                  <p key={a.userId} className="t-cap">
                    {a.name} — {a.status === "approved" ? "подтверждён" : `отказ: ${a.rejectReason ?? "без причины"}`}
                    {a.reviewedAt && ` · ${dateF.format(new Date(a.reviewedAt))}`}
                  </p>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* Сводка */}
        {stats.isLoading ? <SkeletonRow /> : stats.data && (
          <section>
            <p className="t-micro mb-2">Люди</p>
            <div className="grid grid-cols-3 gap-2">
              <Tile value={stats.data.users.total} label="всего" />
              <Tile value={stats.data.users.activeWeek} label="активны за неделю" />
              <Tile value={stats.data.users.newWeek} label="новых за неделю" />
            </div>

            <p className="t-micro mb-2 mt-4">Каталог</p>
            <div className="grid grid-cols-3 gap-2">
              <Tile value={stats.data.users.psychologists} label="психологов" />
              <Tile value={stats.data.verification.approved} label="подтверждено" />
              <Tile value={stats.data.verification.review} label="на проверке" />
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

function Application({ a, busy, onApprove, onReject }: {
  a: PsyApplication;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="card p-3">
      <p className="t-head truncate">{a.name}</p>
      <p className="t-cap mt-0.5 truncate">
        {a.username ? `@${a.username}` : "без ника"} · {a.email ?? "без почты"}
        {a.submittedAt && ` · подал ${dateF.format(new Date(a.submittedAt))}`}
      </p>
      <p className="t-cap mt-0.5">
        {a.method || "метод не указан"} · опыт {a.experienceYears} лет · {a.sessionPrice} ₽
        {a.city && ` · ${a.city}`}
      </p>
      {a.education && <p className="t-body mt-1.5">{a.education}</p>}
      {a.about && <p className="t-cap mt-1">{a.about}</p>}
      {a.publicLink && (
        <a href={a.publicLink} target="_blank" rel="noreferrer" className="t-cap mt-1 block underline">
          {a.publicLink}
        </a>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button disabled={busy} onClick={onApprove} className="btn btn-accent px-3 py-1.5 text-[11px] disabled:opacity-40">
          Одобрить
        </button>
        <button disabled={busy} onClick={() => { tap(); onReject(); }} className="btn btn-white px-3 py-1.5 text-[11px] disabled:opacity-40">
          На доработку
        </button>
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
