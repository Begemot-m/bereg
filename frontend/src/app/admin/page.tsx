"use client";

import { useState } from "react";

import { PageHead } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Input, SkeletonRow } from "@/components/ui";
import {
  useAdminStats, useAdminUsage, useAdminUsers, useUserAction,
  useReviewVerification, useVerificationQueue,
  useAuditLog, useFunnels, useSeries, useSupportAction, useSupportInbox,
  type FunnelRow, type PsyApplication, type Series, type SupportRow,
  type UsagePeriod, type UsageTotals,
} from "@/lib/admin";
import { tap } from "@/lib/haptics";
import { documentHref } from "@/lib/psy-documents";

const dateF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "2-digit" });
const timeF = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const TOPICS: Record<string, string> = {
  bug: "не работает", billing: "оплата", data: "данные", other: "другое",
};

export default function AdminPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");
  const [auditPage, setAuditPage] = useState(0);
  const [days, setDays] = useState(30);
  const [period, setPeriod] = useState<UsagePeriod>("week");

  const usage = useAdminUsage();
  const stats = useAdminStats();
  const users = useAdminUsers(q, page);
  const act = useUserAction();
  const verification = useVerificationQueue();
  const review = useReviewVerification();
  const support = useSupportInbox();
  const supportAct = useSupportAction();
  const auditLog = useAuditLog(auditFilter, auditPage, auditOpen);
  const series = useSeries(days);
  const funnels = useFunnels();

  // 403 приходит всем, кто не админ: страницу просто не показываем.
  if (users.isError || stats.isError) {
    return <div className="py-16 text-center"><p className="t-head">Доступ только для администратора</p></div>;
  }

  return (
    <div>
      <PageHead title="Админка" sub="Платформа целиком" icon="gear" back="/cabinet" />

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

        {/* Поддержка — второе по срочности: человек уже написал и ждёт. */}
        <section>
          <p className="t-micro mb-2">
            Обращения
            {(support.data?.open.length ?? 0) > 0 && (
              <span className="chip chip-strong ml-1.5">{support.data?.open.length}</span>
            )}
          </p>

          {support.isLoading && <SkeletonRow />}
          {support.data?.open.length === 0 && <p className="t-cap">Разобрано. Новые обращения появятся здесь.</p>}

          <div className="space-y-2">
            {support.data?.open.map((r) => (
              <SupportCard
                key={r.id}
                r={r}
                busy={supportAct.isPending}
                onHandle={() => { tap(); supportAct.mutate({ id: r.id }); }}
                onReply={() => {
                  const reply = prompt(
                    r.userId
                      ? `Ответ уйдёт ${r.name} уведомлением. Что написать?`
                      : `У гостя нет аккаунта — ответ придётся отправить на ${r.contact ?? "указанный контакт"} руками. Обращение просто закроется.`,
                  )?.trim();
                  if (reply) supportAct.mutate({ id: r.id, reply });
                }}
              />
            ))}
          </div>

          {(support.data?.handled.length ?? 0) > 0 && (
            <details className="mt-2">
              <summary className="t-cap cursor-pointer">Недавно разобранные</summary>
              <div className="mt-2 space-y-1.5">
                {support.data?.handled.map((r) => (
                  <div key={r.id} className="flex items-start gap-2">
                    <p className="t-cap min-w-0 flex-1">
                      {r.name} · {TOPICS[r.topic] ?? r.topic} — {r.text.slice(0, 90)}
                      {r.text.length > 90 && "…"}
                    </p>
                    <button
                      onClick={() => { tap(); supportAct.mutate({ id: r.id, reopen: true }); }}
                      className="t-cap shrink-0 underline"
                    >
                      вернуть
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* Посещаемость: первый вопрос к платформе — заходят ли вообще и куда. */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="t-micro">Посещаемость</p>
            <div className="flex gap-1.5">
              {PERIODS.map(({ key, label }) => (
                <button key={key} onClick={() => { tap(); setPeriod(key); }} className={period === key ? "chip chip-strong" : "chip"}>{label}</button>
              ))}
            </div>
          </div>
          {usage.isLoading ? <SkeletonRow /> : usage.data && (
            <UsageBlock totals={usage.data.periods[period]} since={usage.data.since} />
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

        {/* Динамика: итог за всё время не отвечает на вопрос, растём мы или
            встали, — а других вопросов к цифрам сейчас и нет. */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="t-micro">Динамика</p>
            <div className="flex gap-1.5">
              {[30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => { tap(); setDays(d); }}
                  className={days === d ? "chip chip-strong" : "chip"}
                >
                  {d} дней
                </button>
              ))}
            </div>
          </div>

          {series.isLoading && <SkeletonRow />}
          {series.data && (
            <div className="space-y-3">
              <Spark
                label="Регистрации"
                total={series.data.totals.registrations}
                rows={series.data.rows}
                pick={(r) => r.registrations}
                color="var(--iris)"
              />
              <Spark
                label="Записи"
                total={series.data.totals.appointments}
                rows={series.data.rows}
                pick={(r) => r.appointments}
                color="var(--sage)"
              />
              <Spark
                label="Оплаты"
                total={series.data.totals.payments}
                note={paymentsNote(series.data)}
                rows={series.data.rows}
                pick={(r) => r.payments}
                color="var(--ink)"
              />
            </div>
          )}
        </section>

        {/* Воронки: ряды показывают объём, воронка — где он теряется.
            Шага «зашёл в каталог» тут нет: просмотры страниц не пишутся. */}
        <section>
          <p className="t-micro mb-2">Воронки, за всё время</p>

          {funnels.isLoading && <SkeletonRow />}
          {funnels.data && (
            <div className="space-y-3">
              <Funnel
                title="Психолог"
                note="Считаем тех, кто пришёл сам: приглашённые психологом клиенты в базу не входят"
                rows={funnels.data.psychologist}
                color="var(--iris)"
              />
              <Funnel
                title="Клиент"
                note="Каталог и карточка не измеряются — просмотры нигде не сохраняются"
                rows={funnels.data.client}
                color="var(--sage)"
              />
            </div>
          )}
        </section>

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
                      {u.roles.includes("psychologist") ? "психолог" : "клиент"} · {u.clients} клиентов · {u.appointments} сессий
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
                    onClick={() => {
                      const next = u.roles.includes("psychologist") ? "client" : "psychologist";
                      const warn = next === "client"
                        ? `Сделать ${u.name} клиентом? Анкета уйдёт из каталога, клиенты и записи останутся.`
                        : `Сделать ${u.name} психологом? В каталог он попадёт только после проверки анкеты.`;
                      if (confirm(warn)) act.mutate({ id: u.id, body: { role: next } });
                    }}
                    className="btn btn-white px-3 py-1.5 text-[11px]"
                  >
                    {u.roles.includes("psychologist") ? "в клиенты" : "в психологи"}
                  </button>
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

        {/* Журнал. Грузим только когда открыли: на каждый заход он не нужен,
            а записей там больше, чем всего остального вместе взятого. */}
        <section>
          <details onToggle={(e) => setAuditOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="t-micro cursor-pointer">Журнал действий</summary>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {[["", "всё"], ["admin.", "админка"], ["login", "входы"], ["consent", "согласия"]].map(([value, label]) => (
                <button
                  key={label}
                  onClick={() => { tap(); setAuditFilter(value); setAuditPage(0); }}
                  className={auditFilter === value ? "chip chip-strong" : "chip"}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-2 space-y-1.5">
              {auditLog.isLoading && <SkeletonRow />}
              {auditLog.data?.items.length === 0 && <p className="t-cap">Пусто.</p>}
              {auditLog.data?.items.map((r) => (
                <div key={r.id} className="card-soft p-2.5">
                  <p className="t-cap">
                    <span className="font-semibold">{r.action}</span>
                    {r.entity && ` · ${r.entity}${r.entityId ? ` #${r.entityId}` : ""}`}
                  </p>
                  <p className="t-cap mt-0.5">
                    {r.actor} · {timeF.format(new Date(r.createdAt))}
                    {r.ip && ` · ${r.ip}`}
                  </p>
                  {r.meta != null && Object.keys(r.meta as object).length > 0 && (
                    <p className="t-cap mt-0.5 break-all opacity-70">{JSON.stringify(r.meta)}</p>
                  )}
                </div>
              ))}
            </div>

            {(auditLog.data?.pages ?? 0) > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <button disabled={auditPage === 0} onClick={() => setAuditPage((p) => p - 1)} className="btn btn-white px-3 py-1.5 text-[12px] disabled:opacity-40">Назад</button>
                <span className="t-cap">{auditPage + 1} из {auditLog.data?.pages}</span>
                <button disabled={auditPage + 1 >= (auditLog.data?.pages ?? 1)} onClick={() => setAuditPage((p) => p + 1)} className="btn btn-white px-3 py-1.5 text-[12px] disabled:opacity-40">Дальше</button>
              </div>
            )}
          </details>
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
      <div className="flex items-start gap-2.5">
        {a.photo && <img src={a.photo} alt="" className="h-12 w-12 shrink-0 rounded-[11px] object-cover" />}
        <div className="min-w-0 flex-1">
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
        </div>
      </div>

      {/* Подтверждение образования — то, ради чего заявка вообще проверяется */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {typeof a.profilePercent === "number" && <span className="chip">профиль {a.profilePercent}%</span>}
        {/* Новые заявки держат файлы в хранилище — открываем по ссылке роута.
            Старые несут диплом data-URL'ом внутри самой анкеты. */}
        {a.documents?.length
          ? a.documents.map((doc) => (
              <a key={doc.id} href={documentHref(doc.id)} target="_blank" rel="noreferrer" className="chip chip-strong">
                {doc.kind === "diploma" ? "Диплом" : "Сертификат"} · {doc.name}
              </a>
            ))
          : a.diploma
            ? a.diploma.dataUrl
              ? <a href={a.diploma.dataUrl} target="_blank" rel="noreferrer" download={a.diploma.name} className="chip chip-strong">Диплом · {a.diploma.name}</a>
              : <span className="chip">Диплом «{a.diploma.name}» не поместился в хранилище демо</span>
            : <span className="chip">диплом не приложен</span>}
      </div>

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

const moneyF = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

// Пустой ряд оплат раньше означал бы «продаж не было». На деле платежи до
// появления таблицы нигде не сохранялись — про это надо сказать прямо.
function paymentsNote(s: Series) {
  if (!s.paymentsSince) return "история платежей ведётся с этого релиза — ряд наполнится с первой оплатой";
  const since = new Date(s.paymentsSince);
  const revenue = `${moneyF.format(Math.round(s.totals.revenue / 100))} ₽`;
  if (since > new Date(s.from)) return `${revenue} · история платежей ведётся с ${dateF.format(since)}`;
  return revenue;
}

function Funnel({ title, note, rows, color }: {
  title: string;
  note: string;
  rows: FunnelRow[];
  color: string;
}) {
  return (
    <div className="card-soft p-2.5">
      <p className="t-cap">{title}</p>

      <div className="mt-2 space-y-1.5">
        {rows.map((r, i) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="t-cap truncate">{r.label}</p>
              <p className="shrink-0 tabular-nums text-[11px] opacity-70">
                {/* Доля от предыдущего шага важнее общей: она и показывает,
                    на каком именно шаге теряем. */}
                {r.n}
                {i > 0 && ` · ${r.ofPrev}% от шага · ${r.ofFirst}% от начала`}
              </p>
            </div>
            <div className="mt-1 h-1.5 rounded-full" style={{ background: "var(--hairline)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, r.ofFirst)}%`, background: color, opacity: 0.85 }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="t-cap mt-2 opacity-70">{note}</p>
    </div>
  );
}

function Spark({ label, total, note, rows, pick, color }: {
  label: string;
  total: number;
  note?: string;
  rows: Series["rows"];
  pick: (r: Series["rows"][number]) => number;
  color: string;
}) {
  const max = Math.max(1, ...rows.map(pick));
  return (
    <div className="card-soft p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="t-cap">{label}</p>
        <p className="font-tight tabular-nums text-[18px] font-black leading-none">{total}</p>
      </div>

      <div className="mt-2 flex h-9 items-end gap-px">
        {rows.map((r) => {
          const v = pick(r);
          return (
            <div
              key={r.day}
              title={`${r.day}: ${v}`}
              className="min-h-px flex-1 rounded-[1px]"
              style={{
                height: `${Math.max(v > 0 ? 8 : 2, (v / max) * 100)}%`,
                background: color,
                opacity: v > 0 ? 0.85 : 0.15,
              }}
            />
          );
        })}
      </div>

      {note && <p className="t-cap mt-1.5 opacity-70">{note}</p>}
    </div>
  );
}

function SupportCard({ r, busy, onHandle, onReply }: {
  r: SupportRow;
  busy: boolean;
  onHandle: () => void;
  onReply: () => void;
}) {
  return (
    <div className="card p-3">
      <div className="flex items-start gap-2">
        <p className="t-head min-w-0 flex-1 truncate">{r.name}</p>
        <span className="chip shrink-0">{TOPICS[r.topic] ?? r.topic}</span>
      </div>
      <p className="t-cap mt-0.5 truncate">
        {r.username ? `@${r.username}` : r.contact ?? "без контакта"}
        {r.email && ` · ${r.email}`} · {timeF.format(new Date(r.createdAt))}
      </p>
      <p className="t-body mt-1.5 whitespace-pre-line">{r.text}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button disabled={busy} onClick={() => { tap(); onReply(); }} className="btn btn-accent px-3 py-1.5 text-[11px] disabled:opacity-40">
          Ответить и закрыть
        </button>
        <button disabled={busy} onClick={onHandle} className="btn btn-white px-3 py-1.5 text-[11px] disabled:opacity-40">
          Просто закрыть
        </button>
      </div>
    </div>
  );
}

const PERIODS: { key: UsagePeriod; label: string }[] = [
  { key: "day", label: "день" },
  { key: "week", label: "неделя" },
  { key: "month", label: "месяц" },
  { key: "all", label: "всего" },
];

const SECTION_LABEL: Record<string, string> = {
  home: "Главная", sessions: "Сессии", clients: "Клиенты", catalog: "Каталог",
  cabinet: "Кабинет", tools: "Инструменты", therapy: "С терапевтом", profile: "Профиль",
  admin: "Админка", landing: "Лендинг", onboarding: "Знакомство", support: "Поддержка",
};

/**
 * Сколько людей заходило и в какие разделы. Людей считаем по устройствам:
 * гость каталога не авторизован, но заходил так же, как вошедший.
 */
function UsageBlock({ totals, since }: { totals: UsageTotals; since: string | null }) {
  const max = Math.max(1, ...totals.sections.map((row) => row.visits));
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <Tile value={totals.visitors} label="человек" />
        <Tile value={totals.psychologists} label="психологов" />
        <Tile value={totals.clients} label="клиентов" />
        <Tile value={totals.guests} label="гостей" />
      </div>

      <p className="t-micro mb-2 mt-4">Разделы · {totals.visits} заходов</p>
      {totals.sections.length === 0 ? (
        <p className="t-cap">
          {since ? "За выбранный период заходов не было." : "Заходы начали писаться недавно — данные появятся в ближайшие часы."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {totals.sections.map((row) => (
            <div key={row.section} className="card-soft flex items-center gap-3 p-2.5">
              <span className="w-[92px] shrink-0 text-[12px] font-black leading-tight">{SECTION_LABEL[row.section] ?? row.section}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div className="h-full rounded-full" style={{ width: `${Math.round((row.visits / max) * 100)}%`, background: "var(--ink)" }} />
              </div>
              <span className="tabular-nums shrink-0 text-[11px] font-black">{row.visits}</span>
              <span className="t-cap shrink-0 w-[62px] text-right">{row.people} чел.</span>
            </div>
          ))}
        </div>
      )}
      {since && <p className="t-cap mt-2">Считаем с {dateF.format(new Date(since))}</p>}
    </>
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
