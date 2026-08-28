"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/icons";
import { PolicySheet } from "@/components/policy-sheet";
import { apiFetch } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";
import { DEMO } from "@/lib/demo";
import { success, tap } from "@/lib/haptics";
import { connectPsy } from "@/lib/invite";

type ConsentState = { granted?: Record<string, { current: boolean } | undefined> };

function Sheet({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-[130] flex items-end justify-center overscroll-contain bg-[rgba(32,28,24,.5)] p-3 md:items-center"
    >
      <motion.div
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="max-h-[min(88dvh,calc(100dvh-var(--top-pad)-24px))] w-full max-w-md overflow-y-auto rounded-[var(--r-block)] p-5"
        style={{ background: "var(--surface)" }}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/**
 * Согласие на обработку данных для пришедшего по ссылке на запись. Тот же
 * текст и те же два отдельных согласия, что на последнем шаге знакомства, но
 * окном поверх карточки специалиста: человек видит, к кому его позвали, и
 * подтверждает согласие раньше, чем что-то о нём будет записано.
 *
 * По «согласен» специалист сразу становится терапевтом — за этим ссылку и
 * присылают, и до этого его расписание в «Терапии» человеку не показывалось.
 */
export function BookingConsent({ psyId, psyName, onDone }: { psyId: number; psyName?: string; onDone: () => void }) {
  const [pd, setPd] = useState(false);
  const [health, setHealth] = useState(false);
  const [policy, setPolicy] = useState(false);

  const state = useQuery<ConsentState>({
    queryKey: ["consents"],
    queryFn: () => apiFetch<ConsentState>("/consents"),
    enabled: !DEMO,
    retry: false,
  });

  const grant = useMutation({
    mutationFn: async () => {
      if (!DEMO) await apiFetch("/consents", { method: "POST", body: JSON.stringify({ kinds: ["pd", "health"] }) });
      // Мест у специалиста может не быть, а ссылку мог открыть он сам — на
      // согласие это не влияет, дальше человека пускаем в любом случае.
      await connectPsy(psyId).catch(() => {});
    },
    onSuccess: () => { success(); onDone(); },
  });

  // Согласие уже подписано (человек не первый раз в приложении) — окно не
  // показываем вовсе, но специалиста всё равно цепляем: за этим и пришли.
  const granted = state.data?.granted;
  const already = Boolean(granted?.pd?.current && granted?.health?.current);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!already) return;
    void connectPsy(psyId).catch(() => {});
    doneRef.current();
  }, [already, psyId]);

  if (already || (!DEMO && state.isPending)) return null;

  return (
    <Sheet>
      <span className="ico ico-accent h-12 w-12"><Icon name="lock" width={22} weight="bold" color="#fff" /></span>
      <h2 className="font-tight mt-3 text-[21px] font-black leading-tight">Прежде чем записаться</h2>
      <p className="t-sub mt-1.5">
        {psyName ? `${psyName} появится в вашей «Терапии», а «${APP_NAME}»` : `«${APP_NAME}»`} сохранит записи о вас.
        Нужно ваше согласие — по-другому нельзя, и это правильно.
      </p>

      <div className="mt-4 space-y-2">
        <Check
          on={pd}
          onToggle={() => { tap(); setPd((v) => !v); }}
          title="Обработка персональных данных"
          text="Имя, контакты, записи на сессии. Без этого приложение не сможет вас узнавать."
        />
        <Check
          on={health}
          onToggle={() => { tap(); setHealth((v) => !v); }}
          title="Данные о состоянии"
          text="Дневник настроения, заметки терапевту, колесо баланса. Хранятся в зашифрованном виде, видите их вы и выбранный вами специалист."
        />
      </div>

      <p className="t-cap mt-3">
        Подробности — в{" "}
        <button onClick={() => { tap(); setPolicy(true); }} className="font-black underline" style={{ color: "var(--edge)" }}>
          политике обработки данных
        </button>
        . Согласие можно отозвать в кабинете, там же выгрузить или удалить всё разом.
      </p>

      <button
        disabled={!pd || !health || grant.isPending}
        onClick={() => grant.mutate()}
        className="btn mt-4 w-full py-3.5 text-[15px] disabled:opacity-50"
      >
        {grant.isPending ? "Сохраняем…" : "Согласен, продолжить"}
      </button>
      {(!pd || !health) && (
        <p className="t-cap mt-2 text-center">Нужны оба согласия — второе о данных о состоянии обязано быть отдельным.</p>
      )}
      <PolicySheet open={policy} onClose={() => setPolicy(false)} />
    </Sheet>
  );
}

/**
 * Предложение пройти знакомство. Всплывает, когда человек, пришедший ради
 * записи, впервые уходит с карточки специалиста в любой другой раздел: до
 * этого момента знакомство только мешало бы тому, за чем он пришёл.
 */
export function OnboardingOffer({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  return (
    <Sheet>
      <span className="ico ico-accent h-12 w-12"><Icon name="spark" width={22} weight="fill" color="#fff" /></span>
      <h2 className="font-tight mt-3 text-[21px] font-black leading-tight">Познакомимся с приложением?</h2>
      <p className="t-sub mt-1.5">
        Займёт минуту: покажем, что тут есть кроме записи — терапия, дневник состояния и инструменты для
        самостоятельной работы.
      </p>
      <button onClick={() => { tap(); onStart(); }} className="btn btn-accent mt-4 w-full py-3.5 text-[14px]">
        Пройти знакомство
      </button>
      <button onClick={() => { tap(); onLater(); }} className="mt-2 w-full py-2 text-[12.5px] font-black" style={{ color: "var(--muted)" }}>
        Не сейчас
      </button>
    </Sheet>
  );
}

function Check({ on, onToggle, title, text }: { on: boolean; onToggle: () => void; title: string; text: string }) {
  return (
    <button onClick={onToggle} className="card flex w-full items-start gap-3 p-3.5 text-left" aria-pressed={on}>
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] keep-style"
        style={{ background: on ? "var(--ink)" : "#fff", border: `var(--bw) solid ${on ? "var(--ink)" : "var(--edge)"}` }}
      >
        {on && <Icon name="check" width={14} weight="bold" color="#fff" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-head block leading-tight">{title}</span>
        <span className="t-cap mt-1 block">{text}</span>
      </span>
    </button>
  );
}
