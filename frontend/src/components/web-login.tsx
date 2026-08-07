"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { isEmail } from "@/lib/account";
import { loginWithEmail, requestEmailCode } from "@/lib/api";
import { APP_NAME, BOT_NAME, botDeepLink } from "@/lib/brand";
import { DEMO, DEMO_EMAIL_CODE, leaveDemoWebGuest } from "@/lib/demo";

type Step = "email" | "code";

/**
 * Вход с компьютера. Почта — второй ключ к тому же аккаунту: сервер не заводит
 * по ней новых пользователей, и код приходит только на адрес, привязанный
 * внутри мини-приложения. Поэтому «код отправлен» здесь ничего не подтверждает
 * — ответ одинаковый и для знакомой почты, и для чужой.
 */
export function WebLogin({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [again, setAgain] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  // Повторную отправку прячем на минуту: сервер всё равно ограничивает частоту,
  // и упереться в его отказ хуже, чем подождать с понятным счётчиком.
  useEffect(() => {
    if (again <= 0) return;
    const timer = setTimeout(() => setAgain((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [again]);

  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

  const sendCode = async () => {
    if (!isEmail(email) || busy) return;
    setBusy(true);
    setError("");
    try {
      await requestEmailCode(email.trim());
      setStep("code");
      setAgain(60);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      await loginWithEmail(email.trim(), code);
      // Сессия лежит в куках. Перезагрузка — самый честный способ войти:
      // приложение поднимется обычным путём, а не с половиной состояния.
      if (DEMO) leaveDemoWebGuest();
      window.location.replace(window.location.pathname);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: "rgba(20,20,22,.55)" }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[24px] p-6 md:p-7"
        style={{ background: "var(--page)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="ico ico-accent h-12 w-12"><Icon name="lock" width={22} weight="bold" color="#fff" /></span>
          <button onClick={onClose} className="x-close" aria-label="Закрыть">
            <Icon name="close" width={14} weight="bold" color="#fff" />
          </button>
        </div>

        <h2 className="font-tight mt-4 text-[24px] font-black leading-tight">
          {step === "email" ? "Вход по почте" : "Код из письма"}
        </h2>
        <p className="t-sub mt-1.5">
          {step === "email"
            ? `Работает та почта, которую вы привязали в ${APP_NAME} внутри Telegram: кабинет → «Почта для входа».`
            : `Отправили шестизначный код на ${email.trim()}. Письмо приходит за минуту, иногда попадает в «Промоакции».`}
        </p>

        {step === "email" ? (
          <>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="send"
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void sendCode(); }}
              placeholder="you@example.com"
              className="stroke mt-5 w-full rounded-[15px] px-4 py-3.5 text-[15px] font-semibold outline-none"
              style={{ background: "var(--surface)" }}
            />
            <button onClick={() => void sendCode()} disabled={!isEmail(email) || busy} className="btn btn-accent mt-3 w-full py-3.5">
              {busy ? "Отправляем…" : "Получить код"}
            </button>
          </>
        ) : (
          <>
            <input
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="go"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void submitCode(); }}
              placeholder="000000"
              className="stroke mt-5 w-full rounded-[15px] px-4 py-3.5 text-center text-[24px] font-black tracking-[.35em] outline-none"
              style={{ background: "var(--surface)" }}
            />
            <button onClick={() => void submitCode()} disabled={code.length !== 6 || busy} className="btn btn-accent mt-3 w-full py-3.5">
              {busy ? "Проверяем…" : "Войти"}
            </button>
            <div className="mt-3 flex items-center justify-between">
              <button onClick={() => { setStep("email"); setCode(""); setError(""); }} className="text-[12.5px] font-bold text-[var(--muted)]">
                Другая почта
              </button>
              <button
                onClick={() => void sendCode()}
                disabled={again > 0 || busy}
                className="text-[12.5px] font-bold text-[var(--muted)] disabled:opacity-45"
              >
                {again > 0 ? `Новый код через ${again} с` : "Отправить снова"}
              </button>
            </div>
            {DEMO && <p className="t-cap mt-3 opacity-70">В демо писем нет — подойдёт код {DEMO_EMAIL_CODE}.</p>}
          </>
        )}

        {error && <p className="mt-3 text-[13px] font-bold" style={{ color: "var(--danger)" }}>{error}</p>}

        <p className="t-cap mt-5 leading-snug opacity-70">
          Ещё нет аккаунта? Он заводится в Telegram — <a href={botDeepLink("login")} target="_blank" rel="noreferrer" className="font-black underline">t.me/{BOT_NAME}</a>.
          Там же в кабинете привязывается почта.
        </p>
      </motion.div>
    </div>
  );
}
