"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { PolicySheet } from "@/components/policy-sheet";
import { apiFetch } from "@/lib/api";
import { DEMO } from "@/lib/demo";
import { success, tap } from "@/lib/haptics";
import { markOnboardedFromServer, useOnboarded } from "@/lib/profile";

type ConsentState = {
  policyVersion: string;
  granted: Record<string, { policyVersion: string; grantedAt: string; current: boolean }>;
};

/**
 * Экран согласия при первом входе и после смены редакции политики.
 *
 * Два согласия, а не одно: обработка обычных данных и отдельно — данных о
 * состоянии между сессиями. Второе обязано быть отдельным и осознанным,
 * поэтому галочки не проставлены заранее и «продолжить» без них не работает.
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [pd, setPd] = useState(false);
  const [health, setHealth] = useState(false);
  const [policy, setPolicy] = useState(false);
  const [onboarded] = useOnboarded();

  const state = useQuery<ConsentState>({
    queryKey: ["consents"],
    queryFn: () => apiFetch<ConsentState>("/consents"),
    enabled: !DEMO,
    retry: false,
  });

  const grant = useMutation({
    mutationFn: () => apiFetch("/consents", { method: "POST", body: JSON.stringify({ kinds: ["pd", "health"] }) }),
    onSuccess: () => { success(); qc.invalidateQueries({ queryKey: ["consents"] }); },
  });

  // Отметка о пройденном знакомстве лежит в localStorage, а согласие — в базе.
  // На втором устройстве отметки нет, и человек, давно работающий в платформе,
  // получал знакомство заново. Подписанное согласие и есть доказательство, что
  // знакомство пройдено, — переносим отметку с сервера.
  const granted = state.data?.granted;
  useEffect(() => {
    if (DEMO || onboarded !== false) return;
    if (granted?.pd?.current && granted?.health?.current) markOnboardedFromServer();
  }, [granted, onboarded]);

  // В демо ничего не собираем: данных настоящих нет, и экран только мешал бы
  // смотреть приложение. Ошибку запроса тоже не превращаем в стену — иначе
  // упавший бэкенд закрывает доступ вообще ко всему.
  if (DEMO || state.isLoading || state.isError) return <>{children}</>;

  // Пока человек не прошёл знакомство, стены нет: согласие он даёт галочкой на
  // последнем шаге онбординга. Юридический экран впереди приветствия выглядел
  // так, будто приложение сломалось на первом же открытии.
  if (onboarded !== true) return <>{children}</>;

  const g = state.data?.granted ?? {};
  const ok = g.pd?.current && g.health?.current;
  if (ok) return <>{children}</>;

  const renewal = Boolean(g.pd) || Boolean(g.health);

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto" style={{ background: "var(--page)" }}>
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-[var(--top-pad)]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <span className="ico ico-accent h-14 w-14"><Icon name="lock" width={26} weight="bold" color="#fff" /></span>
          <h1 className="font-tight mt-3 text-[24px] font-black leading-tight">
            {renewal ? "Политика обновилась" : "Прежде чем начать"}
          </h1>
          <p className="t-sub mt-1.5">
            {renewal
              ? "Мы обновили документ об обработке данных. Подтвердите согласие ещё раз — это займёт полминуты."
              : "Приложение хранит записи о вас. Нужно ваше согласие — по-другому нельзя, и это правильно."}
          </p>

          <div className="mt-5 space-y-2">
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

          {/* Не ссылка, а лист: этот экран висит поверх приложения на любом
              маршруте, и переход на /policy возвращал его же. */}
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
            className="btn mt-5 w-full py-3.5 text-[15px]"
          >
            {grant.isPending ? "Сохраняем…" : "Согласен, продолжить"}
          </button>
          {(!pd || !health) && (
            <p className="t-cap mt-2 text-center">Нужны оба согласия — второе о данных о состоянии обязано быть отдельным.</p>
          )}
          <PolicySheet open={policy} onClose={() => setPolicy(false)} />
        </motion.div>
      </div>
    </div>
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
