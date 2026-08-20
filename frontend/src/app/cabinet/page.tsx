"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Arrow, PageHead, SectionTitle, ArrowGlyph } from "@/components/blocks";
import { CareModule } from "@/components/care-module";
import { Icon, type IconName } from "@/components/icons";
import { InviteBanner } from "@/components/invite";
import { Reveal } from "@/components/motion";
import { Onboarding } from "@/components/onboarding";
import { ProfileEditor } from "@/components/profile-editor";
import { RemindersModule } from "@/components/reminders";
import { SubscriptionBanner } from "@/components/subscription-block";
import { Button, Card, Input } from "@/components/ui";
import { bindAccountEmail, confirmAccountEmail, getAccountEmail, isEmail, unbindAccountEmail } from "@/lib/account";
import { apiFetch } from "@/lib/api";
import { asset } from "@/lib/asset";
import { AUTHOR_TG, AUTHOR_TG_URL, CENTER_SITE, CENTER_URL } from "@/lib/brand";
import { DEMO_OWNER, useMe } from "@/lib/me";
import { DEMO, isFreshDemo, resetLocalData, startFreshDemo, stopFreshDemo } from "@/lib/demo";
import { select, success, tap } from "@/lib/haptics";
import { useVerification } from "@/lib/psy-verification";
import { ROLE_LABEL, setRole, setRoleIntent, useRole, useRoleIntent, type Role } from "@/lib/role";
import { addToHomeScreen, homeScreenMode, homeScreenStatus, onHomeScreenAdded, openTelegramLink, type HomeScreenMode } from "@/lib/telegram";

const ROLES: Role[] = ["psychologist", "client"];

// Версия = дата сборки в календарном виде. Если после деплоя тут старое число —
// вебвью показывает страницу из кеша, а не новую сборку.
function versionLabel(): string {
  const raw = process.env.NEXT_PUBLIC_BUILD;
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export default function CabinetPage() {
  const [role, switchRole] = useRole();
  const router = useRouter();
  const psy = role === "psychologist";
  // Знакомство из кабинета — просмотр поверх приложения. Ничего не сбрасываем:
  // раньше кнопка снимала флаг онбординга, и человек оказывался в развилке
  // ролей, будто он тут впервые.
  const [intro, setIntro] = useState(false);

  return (
    <div className="stroke-mid">
      {intro && <Onboarding startRole={role} preview onClose={() => setIntro(false)} />}
      <PageHead title="Личный кабинет">
        <ProfileEditor
          key={role}
          embedded
          professional={psy}
          roleControl={<RoleControl role={role} onSwitch={switchRole} />}
        />
      </PageHead>

      <Reveal y={10}>
      <div className="-mx-4 min-h-[64vh] space-y-6 rounded-t-[27px] px-4 pb-6 pt-5 @md:-mx-9 @md:px-9" style={{ background: "var(--surface)" }}>

        {/* Управление — под роль */}
        <div className="space-y-3">
          <SectionTitle>{psy ? "Практика" : "Забота о себе"}</SectionTitle>
          {psy ? (
            <SubscriptionBanner />
          ) : (
            <div className="card-soft flex items-start gap-3 p-4" style={{ background: "var(--purple-soft)" }}>
              <span className="ico ico-white h-11 w-11 shrink-0"><Icon name="spark" width={21} weight="bold" color="var(--purple-edge)" /></span>
              <div className="min-w-0">
                <p className="t-micro" style={{ color: "var(--purple-edge)" }}>Хроника PRO</p>
                <p className="t-body mt-1">Скоро появятся расширенные инструменты для самостоятельной работы по подписке PRO.</p>
              </div>
            </div>
          )}
        </div>

        {!psy && (
          <div>
            <SectionTitle>Напоминания о сессиях</SectionTitle>
            <RemindersModule />
          </div>
        )}

        {/* Учётная запись. Привязку почты временно убрали из кабинета —
            блок и роуты живы, вернём вместе с десктопным входом. */}

        {/* Видно только владельцу платформы */}
        <AdminEntry />

        {/* Иконка приложения на телефоне */}
        <HomeScreenCard />

        {/* Приватность и данные */}
        <div>
          <SectionTitle>Приватность и данные</SectionTitle>
          {/* Заливка тиффани только у самого текста о конфиденциальности —
              действия ниже живут на белом, это не часть обещания. */}
          <div className="overflow-hidden rounded-[20px]" style={{ background: "var(--tiffany-soft)" }}>
            <div className="flex items-start gap-3 p-4">
              <span className="ico ico-white h-11 w-11 shrink-0"><Icon name="lock" width={21} weight="bold" color="var(--tiffany-edge)" /></span>
              <div className="min-w-0">
                <p className="t-head">Конфиденциальность</p>
                <p className="t-sub mt-1 font-normal">Настроение, заметки, задания и переписка передаются и хранятся в зашифрованном виде. Мы их не читаем, не передаём третьим лицам, не используем для рекламы и не обучаем на них модели. Доступ есть у вас и у специалиста, которого вы выбрали сами, — больше ни у кого.</p>
              </div>
            </div>
          </div>
          <div className="mt-2 space-y-1 overflow-hidden rounded-[20px] px-2.5 py-2" style={{ background: "var(--surface)" }}>
            <ActionRow icon="compass" title="Посмотреть знакомство заново" tone="var(--amber-edge)" onClick={() => { tap(); setIntro(true); }} />
            <WipeDataRow />
          </div>
        </div>

        {/* Документы: сами реквизиты оператора живут в политике, дублировать их
            в кабинете незачем. */}
        <div>
          <SectionTitle>Документы</SectionTitle>
          <div className="space-y-1 overflow-hidden rounded-[20px] px-2.5 py-2" style={{ background: "var(--surface)" }}>
            <ActionRow icon="book" title="Политика обработки данных" tone="var(--purple-edge)" onClick={() => router.push("/policy")} />
            <ActionRow icon="book" title="Документы" tone="var(--tiffany-edge)" onClick={() => router.push("/docs")} />
          </div>
        </div>

        {/* Приглашения */}
        {psy && (
          <div>
            <SectionTitle>Приглашение клиентов</SectionTitle>
            <div className="space-y-1 overflow-hidden rounded-[20px] px-2.5 py-2" style={{ background: "var(--surface)" }}>
              <ActionRow icon="telegram" title="Ссылки для клиентов" tone="var(--tiffany-edge)" onClick={() => router.push("/cabinet/invite")} />
            </div>
          </div>
        )}

        <div>
          <SectionTitle>Приглашайте друзей</SectionTitle>
          <InviteBanner variant={psy ? "psy" : "client"} />
        </div>

        {/* Связь с командой */}
        <CareModule />

        {/* Роль психолога — только для тех, кто выбрал клиента в онбординге */}
        <PsyRoleRequest />

        {/* О приложении */}
        <div>
          <SectionTitle>О приложении</SectionTitle>
          <Card className="flex items-center gap-3">
            <Icon name="angel" width={26} weight="fill" color="var(--ink)" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-snug">Платформа создана центром «Амур и Психея»</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] font-black" style={{ color: "var(--purple-edge)" }}>
                <a href={CENTER_URL} target="_blank" rel="noopener noreferrer" onClick={tap} className="underline-offset-2 hover:underline">{CENTER_SITE}</a>
                <button type="button" onClick={() => { tap(); openTelegramLink(AUTHOR_TG_URL); }} className="font-black underline-offset-2 hover:underline">{AUTHOR_TG}</button>
              </p>
              <p className="tnum mt-1 text-[10.5px] font-black text-[var(--muted-2)]">Версия {versionLabel()}</p>
            </div>
          </Card>
        </div>

      </div>
      </Reveal>
    </div>
  );
}

// Иконка мини-приложения на рабочем столе телефона.
//
// Положить ярлык сам умеет только Telegram для Android (Bot API 8.0). На iPhone
// метод в API есть, но не делает ничего: iOS не разрешает приложениям ставить
// иконки. Раньше человек видел там живую кнопку, жал — и не происходило ничего.
// Теперь на таких клиентах вместо кнопки — шаги: ярлык ставится из браузера.
// На компьютере блока нет. В демо показываем ручной путь: демо и так открывают
// из браузера, шаги в нём настоящие.
const HOME_HIDDEN_KEY = "bereg_home_hidden";

function HomeScreenCard() {
  const [mode, setMode] = useState<HomeScreenMode | null>(null);
  const [added, setAdded] = useState(false);
  const [asked, setAsked] = useState(false);
  // Блок закрывается крестиком навсегда: иконку ставят один раз, и висеть
  // разделом в кабинете ему потом незачем.
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(localStorage.getItem(HOME_HIDDEN_KEY) === "1");
  }, []);

  useEffect(() => {
    if (DEMO) { setMode("manual"); return; }
    let alive = true;
    let off = () => {};
    // telegram-web-app.js подключается отложенно — спрашиваем не в первый кадр.
    const timer = setTimeout(() => {
      if (!alive) return;
      const next = homeScreenMode();
      setMode(next);
      if (next !== "native") return;
      off = onHomeScreenAdded(() => { if (alive) setAdded(true); });
      void homeScreenStatus().then((s) => { if (alive && s === "added") setAdded(true); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); off(); };
  }, []);

  if (hidden || !mode || mode === "none") return null;

  const add = () => {
    setAsked(true);
    if (DEMO) { success(); setAdded(true); return; }
    addToHomeScreen();
  };

  const close = () => {
    tap();
    localStorage.setItem(HOME_HIDDEN_KEY, "1");
    setHidden(true);
  };

  // Шаги владельца, дословно: путь через встроенный браузер Telegram — тот
  // самый, который на телефоне действительно доводит до иконки.
  const steps = [
    'Нажмите три точки в правом верхнем углу → Добавить на экран «Домой»',
    'В открывшемся окне нажмите три точки в нижней панели → Поделиться → Показать больше → Добавить на экран «Домой»',
  ];

  return (
    <div className="relative overflow-hidden rounded-[20px]" style={{ background: "var(--amber-soft)" }}>
      <button
        onClick={close}
        aria-label="Больше не показывать"
        className="absolute right-2.5 top-2.5 z-[1] flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-[14px] font-black transition-transform active:scale-90"
      >
        ×
      </button>
      <div>
        <div className="flex items-start gap-3 p-4">
          <span className="ico ico-white h-11 w-11 shrink-0"><Icon name="device" width={21} weight="bold" color="var(--amber-edge)" /></span>
          <div className="min-w-0 flex-1 pr-7">
            <p className="t-head">Добавьте иконку на рабочий стол</p>
            <p className="t-sub mt-1 font-normal">Хроника всегда будет под рукой и будет открываться с экрана телефона.</p>
            <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] font-bold leading-snug" style={{ color: "var(--amber-edge)" }}>
              <Icon name="warn" width={14} weight="bold" color="var(--amber-edge)" className="mt-[1px] shrink-0" />
              Для жителей РФ необходим включенный VPN
            </p>

            {added ? (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: "var(--green-soft)", color: "var(--green-edge)" }}>
                <Icon name="check" width={13} weight="bold" color="var(--green-edge)" /> Иконка уже на месте
              </span>
            ) : mode === "native" ? (
              <>
                <Button size="sm" className="mt-3" onClick={add}>Добавить на рабочий стол</Button>
                {asked && <p className="t-cap mt-2 leading-snug opacity-70">Подтвердите добавление в окне Telegram — иконка появится на экране телефона.</p>}
              </>
            ) : (
              <>
                <ol className="mt-3 space-y-1.5">
                  {steps.map((step, i) => (
                    <li key={step} className="flex items-start gap-2">
                      <span className="mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-black" style={{ background: "#fff", color: "var(--amber-edge)" }}>{i + 1}</span>
                      <span className="t-sub font-normal">{step}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Удаление сведений о себе. Доступ при этом остаётся: закрывать человеку вход
// в его же кабинет за то, что он попросил стереть данные, — не то, о чём он
// просил. Карточки клиентов, записи на приём и подписка не трогаются.
function WipeDataRow() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const wipe = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await apiFetch("/my/data", { method: "DELETE" });
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    resetLocalData();
    location.reload();
  };

  return (
    <>
      <ActionRow
        icon="gear"
        title={busy ? "Удаляем…" : "Удалить мои данные"}
        danger
        onClick={() => { tap(); setConfirming(true); }}
      />
      <WipeConfirm
        open={confirming}
        busy={busy}
        failed={failed}
        onClose={() => { setConfirming(false); setFailed(false); }}
        onConfirm={wipe}
      />
    </>
  );
}

// Пауза перед подтверждением. Три секунды — не формальность: кнопка стоит в
// списке рядом с безобидными, а стёртый дневник не вернуть.
const WIPE_DELAY_SEC = 3;

function WipeConfirm({ open, busy, failed, onClose, onConfirm }: { open: boolean; busy: boolean; failed: boolean; onClose: () => void; onConfirm: () => void }) {
  const [left, setLeft] = useState(WIPE_DELAY_SEC);

  useEffect(() => {
    if (!open) { setLeft(WIPE_DELAY_SEC); return; }
    const timer = setInterval(() => setLeft((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(timer);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75] flex items-end justify-center bg-[rgba(32,28,24,.44)] p-3" onClick={onClose}>
          <motion.div
            initial={{ y: 42 }}
            animate={{ y: 0 }}
            exit={{ y: 42, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            onClick={(event) => event.stopPropagation()}
            className="chunk w-full max-w-md overflow-hidden bg-white p-5"
          >
            <div className="flex items-start gap-3">
              <span className="ico ico-mid h-11 w-11 shrink-0" style={{ background: "var(--danger)" }}><Icon name="lock" width={20} weight="bold" color="#fff" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-tight text-[18px] font-black leading-tight">Удалить все сведения о себе?</p>
                <p className="t-body mt-1.5">Дневник, отметки настроения, задания, колесо, анкета специалиста и привязка почты будут стёрты безвозвратно. Вход в приложение останется, карточки клиентов и записи на приём не тронем.</p>
              </div>
            </div>
            {failed && <p className="t-cap mt-3" style={{ color: "var(--danger)" }}>Не получилось. Проверьте связь и попробуйте ещё раз.</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => { tap(); onClose(); }} className="btn btn-white flex-1">Отмена</button>
              <Button className="flex-1" disabled={left > 0 || busy} onClick={onConfirm} style={{ background: "var(--danger)", borderColor: "var(--danger)" }}>
                {busy ? "Удаляем…" : left > 0 ? `Удалить · ${left}` : "Удалить"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Вход в админку. Виден только владельцу платформы: обычный пользователь
// блока не видит и по прямой ссылке ничего не получит — роуты админки
// отвечают 403. В демо владелец входит ссылкой `?admin=1`.
function AdminEntry() {
  const me = useMe();
  const owner = me.data?.isAdmin && me.data.username?.replace(/^@/, "").toLowerCase() === DEMO_OWNER;

  if (!owner) return null;

  return (
    <div>
      <SectionTitle>Платформа</SectionTitle>
      <Link href="/admin" onClick={tap} className="card flex items-center gap-3 p-3.5 transition-transform active:scale-[0.99]">
        <span className="ico ico-accent h-11 w-11 shrink-0"><Icon name="gear" width={20} weight="bold" color="#fff" /></span>
        <span className="min-w-0 flex-1">
          <span className="t-micro block">Только для вас</span>
          <span className="t-head mt-0.5 block leading-tight">Админка</span>
          <span className="t-cap mt-0.5 block">Сводка, пользователи, выдача доступа</span>
        </span>
        <Arrow />
      </Link>
      <FreshDemoButton />
    </div>
  );
}

// Показать приложение глазами новичка. Живёт только в демо: стирает локальные
// данные прототипа и поднимает пустой кабинет — знакомство, блок «С чего
// начать», разделы без клиентов и записей. В бою кнопки нет вовсе (DEMO там
// false), и трогать боевую учётную запись ей нечем: сервера демо не знает.
function FreshDemoButton() {
  const [asking, setAsking] = useState(false);
  const [fresh, setFresh] = useState(false);

  useEffect(() => { setFresh(isFreshDemo()); }, []);

  if (!DEMO) return null;

  const go = () => {
    if (fresh) stopFreshDemo();
    else startFreshDemo();
    window.location.replace(asset("/"));
  };

  return (
    <div className="mt-2 rounded-[20px] px-3.5 py-3" style={{ background: "var(--purple-soft)" }}>
      <p className="t-head">{fresh ? "Сейчас интерфейс новичка" : "Посмотреть как новичок"}</p>
      <p className="t-cap mt-1 leading-snug">
        {fresh
          ? "Демо показывает первый день: ни клиентов, ни записей, ни анкеты. Можно вернуть готовую практику."
          : "Демо очистится: ни клиентов, ни записей, ни анкеты — интерфейс первого дня. Боевой аккаунт это не трогает, там данные на сервере."}
      </p>
      {asking ? (
        <div className="mt-2.5 flex gap-2">
          <button onClick={() => { tap(); setAsking(false); }} className="btn btn-white flex-1 py-1.5 text-[12px]">Отмена</button>
          <Button className="flex-1 py-1.5 text-[12px]" onClick={go}>{fresh ? "Вернуть" : "Очистить демо"}</Button>
        </div>
      ) : (
        <Button size="sm" className="mt-2.5" onClick={() => { tap(); setAsking(true); }}>{fresh ? "Вернуть демо-данные" : "Сделать интерфейс новичка"}</Button>
      )}
    </div>
  );
}

// Временно не рендерится в кабинете (см. блок «Учётная запись»), но остаётся
// рабочим: вернём, когда доделаем вход с десктопа.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EmailLink() {
  const qc = useQueryClient();
  const account = useQuery({
    queryKey: ["account-email"],
    queryFn: getAccountEmail,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => query.state.data?.email && !query.state.data.verified ? 5000 : false,
  });
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const ok = isEmail(draft);
  const email = account.data?.email ?? null;

  const bind = useMutation({
    mutationFn: bindAccountEmail,
    onSuccess: (data) => {
      qc.setQueryData(["account-email"], data);
      setNotice(data.message ?? "Ссылка для подтверждения отправлена на почту");
      setEditing(false);
    },
    onError: () => setNotice("Не удалось отправить письмо. Попробуйте ещё раз."),
  });
  const verify = useMutation({
    mutationFn: confirmAccountEmail,
    onSuccess: (data) => { qc.setQueryData(["account-email"], data); setNotice(""); },
  });
  const unbind = useMutation({
    mutationFn: unbindAccountEmail,
    onSuccess: () => { qc.setQueryData(["account-email"], { email: null, verified: false }); setDraft(""); setEditing(false); setNotice(""); },
  });

  if (email && account.data?.verified && !editing) {
    return (
      <Card style={{ borderColor: "var(--head)" }}>
        <div className="flex items-center gap-3">
          <span className="ico ico-mid h-11 w-11 shrink-0"><Icon name="check" width={20} weight="bold" color="#fff" /></span>
          <div className="min-w-0 flex-1">
            <p className="t-head">Успешно привязана почта</p>
            <p className="t-cap truncate">{email}</p>
          </div>
          <button onClick={() => { tap(); setDraft(email); setEditing(true); }} className="btn btn-white shrink-0 px-3 py-1.5 text-[12px]">Изменить</button>
        </div>
        <p className="t-body mt-3">С этой почтой вы входите в десктопную версию на других устройствах.</p>
      </Card>
    );
  }

  if (email && !editing) {
    return (
      <Card style={{ borderColor: "var(--head)" }}>
        <div className="flex items-center gap-3">
          <span className="ico h-11 w-11 shrink-0"><Icon name="telegram" width={20} weight="bold" color="var(--edge)" /></span>
          <div className="min-w-0 flex-1">
            <p className="t-head">Подтверждение отправлено</p>
            <p className="t-cap truncate">{email}</p>
          </div>
        </div>
        <p className="t-body mt-3">{notice || "Перейдите по ссылке из письма, чтобы подтвердить адрес."}</p>
        <div className="mt-3 flex gap-2">
          {account.data?.canConfirm && <button onClick={() => { tap(); verify.mutate(); }} disabled={verify.isPending} className="btn flex-1" style={{ background: "var(--head)", borderColor: "var(--head)", color: "#fff" }}>Подтвердить</button>}
          <button onClick={() => { tap(); setDraft(email); setEditing(true); }} className="btn btn-white flex-1">Изменить</button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ borderColor: "var(--head)" }}>
      <p className="t-cap">Привяжите почту, чтобы входить в десктопную версию на других устройствах</p>
      <div className="mt-2.5 flex gap-2">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="done"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="you@example.com"
        />
        <button
          onClick={() => { tap(); bind.mutate(draft); }}
          disabled={!ok || bind.isPending}
          className="btn shrink-0 px-3.5 py-2 text-[12px]"
          style={{ background: "var(--head)", borderColor: "var(--head)", color: "#fff" }}
        >
          {bind.isPending ? "Отправляем…" : "Привязать"}
        </button>
      </div>
      {email && (
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => { setEditing(false); setDraft(""); }} className="text-[12px] font-bold text-[var(--muted)]">Отмена</button>
          <button onClick={() => { if (confirm("Отвязать почту?")) unbind.mutate(); }} className="text-[12px] font-bold" style={{ color: "var(--danger)" }}>Отвязать</button>
        </div>
      )}
      {draft && !ok && <p className="mt-1.5 text-[11px] font-semibold" style={{ color: "var(--danger)" }}>Похоже, в адресе опечатка</p>}
      {notice && <p className="t-cap mt-2" style={{ color: "var(--danger)" }}>{notice}</p>}
    </Card>
  );
}

// Роль выбирают в онбординге. Кто выбрал клиента, тумблера не видит вовсе —
// психологом становятся через заявку внизу кабинета, а не одним щелчком.
function useCanSwitchRole() {
  const me = useMe();
  const verification = useVerification();
  const [intent, intentReady] = useRoleIntent();
  // Кто уже работает психологом на этом устройстве, но зашёл до появления
  // «намерения»: без этого страж ниже молча вернул бы его в клиенты.
  const [role] = useRole();

  const status = verification.data?.status ?? "none";
  // В демо сервера нет, и `me.roles` там всегда с психологом — заглушка, чтобы
  // прототип показывал кабинет специалиста. Верить ей нельзя: иначе тумблер
  // видит и тот, кто выбрал в онбординге клиента. В демо решает только выбор
  // роли и заявка.
  const isPsy = !DEMO && Boolean(me.data?.roles?.includes("psychologist"));
  return {
    ready: !me.isLoading && intentReady,
    loaded: Boolean(me.data) && intentReady,
    // Решает только выбор роли: кто в онбординге выбрал клиента, тумблера не
    // видит вовсе. Статус заявки сюда не входит — из-за него переключатель
    // всплывал у клиентов, едва верификация переставала быть «none».
    canSwitch: isPsy || intent === "psychologist" || (intent === null && role === "psychologist"),
    // Роль выбрана на устройстве, а в базе человек всё ещё клиент. Так вышло
    // у всех, кто перешёл в психологи, пока переход не доезжал до сервера.
    needsClaim: !DEMO && Boolean(me.data) && intentReady && !isPsy && intent === "psychologist",
    status,
    rejectReason: verification.data?.rejectReason ?? null,
  };
}

function RoleControl({ role, onSwitch }: { role: Role; onSwitch: (r: Role) => void }) {
  const { ready, loaded, canSwitch, needsClaim } = useCanSwitchRole();
  const qc = useQueryClient();
  const claimed = useRef(false);

  useEffect(() => {
    if (loaded && !canSwitch && role === "psychologist") onSwitch("client");
  }, [loaded, canSwitch, role]);

  // Догоняем тех, кто перешёл в психологи, пока переход жил только в браузере:
  // кнопки перехода они уже не видят, а сервер до сих пор считает их клиентами.
  useEffect(() => {
    if (!needsClaim || role !== "psychologist" || claimed.current) return;
    claimed.current = true;
    apiFetch("/profile/role", { method: "POST" })
      .then(() => qc.invalidateQueries({ queryKey: ["me"] }))
      .catch(() => { claimed.current = false; });
  }, [needsClaim, role]);

  if (!ready || !canSwitch) return null;

  // Состояние верификации показывает VerificationPrompt под переключателем —
  // отдельный баннер здесь дублировал его слово в слово.
  return <RoleSwitch role={role} onSwitch={onSwitch} />;
}

// Переход в психологи — в самом низу кабинета. Анкеты тут больше нет: роль
// даётся сразу, а данные о себе человек заполняет уже в профиле специалиста.
function PsyRoleRequest() {
  const { ready, canSwitch } = useCanSwitchRole();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!ready || canSwitch) return null;

  // Роль поднимает сервер: раньше это делала отправка анкеты, и когда анкету
  // из перехода убрали, интерфейс становился психологическим, а в базе человек
  // оставался клиентом — дальше любое действие психолога отвечало отказом.
  const become = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await apiFetch("/profile/role", { method: "POST" });
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    success();
    setRoleIntent("psychologist");
    setRole("psychologist");
    await qc.invalidateQueries({ queryKey: ["me"] });
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div>
      <SectionTitle>Работаете психологом?</SectionTitle>
      <button onClick={() => { tap(); setConfirming(true); }} className="card flex w-full items-center gap-3 p-3.5 text-left transition-transform active:scale-[0.99]">
        <span className="ico ico-mid h-11 w-11 shrink-0"><Icon name="therapy" width={20} weight="bold" color="#fff" /></span>
        <span className="min-w-0 flex-1">
          <span className="t-head block leading-tight">Получить роль психолога</span>
          <span className="t-cap mt-0.5 block">Кабинет специалиста: расписание, клиенты, каталог</span>
        </span>
        <Arrow />
      </button>
      <RoleSwitchConfirm open={confirming} busy={busy} failed={failed} onClose={() => { setConfirming(false); setFailed(false); }} onConfirm={become} />
    </div>
  );
}

// Подтверждение смены роли. Всплывает снизу, как остальные шторки кабинета.
function RoleSwitchConfirm({ open, busy, failed, onClose, onConfirm }: { open: boolean; busy?: boolean; failed?: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75] flex items-end justify-center bg-[rgba(32,28,24,.44)] p-3" onClick={onClose}>
          <motion.div
            initial={{ y: 42 }}
            animate={{ y: 0 }}
            exit={{ y: 42, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            onClick={(event) => event.stopPropagation()}
            className="chunk w-full max-w-md overflow-hidden bg-white p-5"
          >
            <div className="flex items-start gap-3">
              <span className="ico ico-mid h-11 w-11 shrink-0"><Icon name="therapy" width={20} weight="bold" color="#fff" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-tight text-[18px] font-black leading-tight">Сменить роль на психолога?</p>
                <p className="t-body mt-1.5">Кабинет переключится на профессиональный. Вести своих клиентов можно сразу, а чтобы попасть в каталог — заполнить профиль специалиста и пройти верификацию.</p>
              </div>
            </div>
            {failed && <p className="t-cap mt-3" style={{ color: "var(--danger)" }}>Не получилось сменить роль. Проверьте связь и попробуйте ещё раз.</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => { tap(); onClose(); }} className="btn btn-white flex-1">Отмена</button>
              <Button className="flex-1" disabled={busy} onClick={onConfirm}>{busy ? "Меняем…" : "Сменить"}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Переключатель роли: скользящая тёмная плашка (layoutId) + иконки.
function RoleSwitch({ role, onSwitch }: { role: Role; onSwitch: (r: Role) => void }) {
  return (
    <div data-tour="role-switch" className="grid grid-cols-2 gap-1 rounded-[17px] p-1 stroke" style={{ background: "rgba(255,255,255,.5)" }}>
      {ROLES.map((item) => {
        const active = role === item;
        return (
          <button key={item} onClick={() => { select(); onSwitch(item); }} className="relative flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 text-[13px] font-extrabold transition-colors duration-200" style={{ color: active ? "#fff" : "var(--muted)" }} aria-pressed={active}>
            {active && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-[12px] bg-[var(--ink)]" transition={{ type: "spring", stiffness: 480, damping: 34 }} />}
            <span className="relative z-[1] flex items-center gap-1.5"><Icon name={item === "psychologist" ? "therapy" : "user"} width={15} weight="bold" color={active ? "#fff" : "var(--muted)"} /> {ROLE_LABEL[item]}</span>
          </button>
        );
      })}
    </div>
  );
}

// Сворачиваемая секция-карточка: компактная шапка, раскрывается вниз.
function Foldable({ icon, title, subtitle, children, defaultOpen = false, tone }: { icon: IconName; title: string; subtitle: string; children: ReactNode; defaultOpen?: boolean; tone?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="chunk overflow-hidden" style={tone ? { borderColor: `var(--${tone}-edge)` } : undefined}>
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={tone ? { background: `var(--${tone}-soft)`, border: `var(--bw) solid var(--${tone}-edge)` } : { background: "var(--head-soft)", border: "var(--bw) solid var(--stroke)" }}><Icon name={icon} width={18} color={tone ? `var(--${tone}-edge)` : undefined} /></span>
        <span className="flex-1">
          <span className="font-tight block text-[14px] font-bold">{title}</span>
          <span className="t-cap block">{subtitle}</span>
        </span>
        <span className="arrow" style={{ transform: open ? "rotate(90deg)" : "none" }}><ArrowGlyph /></span>
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} style={{ transitionTimingFunction: "var(--ease-out)" }} aria-hidden={!open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--edge-neutral)" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// Строка-действие в списке настроек: иконка + заголовок/описание + шеврон.
function ActionRow({ icon, title, onClick, danger, tone }: { icon: IconName; title: string; onClick: () => void; danger?: boolean; tone?: string }) {
  const fill = danger ? "var(--salmon)" : tone;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[12px] px-1.5 py-2.5 text-left transition-colors hover:bg-[var(--head-soft)] active:scale-[0.99]">
      <span className="ico ico-white h-9 w-9 shrink-0" style={fill ? { background: fill } : undefined}><Icon name={icon} width={17} color={fill ? "#fff" : "var(--edge)"} /></span>
      <span className={`font-tight min-w-0 flex-1 text-[13.5px] font-bold ${danger ? "text-[var(--salmon-edge)]" : ""}`}>{title}</span>
    </button>
  );
}

