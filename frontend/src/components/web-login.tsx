"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { isEmail } from "@/lib/account";
import { loginWithEmail, qrLoginStatus, requestEmailCode, startQrLogin, type QrState } from "@/lib/api";
import { APP_NAME, BOT_NAME, botDeepLink } from "@/lib/brand";
import { DEMO, DEMO_EMAIL_CODE, leaveDemoWebGuest } from "@/lib/demo";

type Step = "qr" | "email" | "code";

/**
 * Вход с компьютера. Почта — второй ключ к тому же аккаунту: сервер не заводит
 * по ней новых пользователей, и код приходит только на адрес, привязанный
 * внутри мини-приложения. Поэтому «код отправлен» здесь ничего не подтверждает
 * — ответ одинаковый и для знакомой почты, и для чужой.
 */
export function WebLogin({ onClose }: { onClose: () => void }) {
  // Telegram — главный вход: аккаунт живёт там, и подтверждение занимает один
  // тап. Почта остаётся вторым ключом к той же учётной записи.
  const [step, setStep] = useState<Step>(DEMO ? "email" : "qr");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [again, setAgain] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const [qr, setQr] = useState<{ image: string; link: string; code: string } | null>(null);
  const [qrState, setQrState] = useState<QrState>("pending");
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  // Код живёт две минуты, поэтому весь цикл — выдача, рисование, опрос — висит
  // на одном эффекте: ушли с вкладки QR или закрыли окно — опрос прекращается.
  useEffect(() => {
    if (step !== "qr" || DEMO) return;
    let alive = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      try {
        const started = await startQrLogin();
        const image = await (await import("qrcode")).default.toDataURL(started.link, {
          width: 520,
          margin: 1,
          color: { dark: "#221f1c", light: "#ffffff" },
        });
        if (!alive) return;
        setQr({ image, link: started.link, code: started.code });
        setQrState("pending");
        setError("");

        const deadline = new Date(started.expiresAt).getTime();
        setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
        tick = setInterval(() => setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000))), 1000);

        poll = setInterval(() => {
          void qrLoginStatus(started.code).then((state) => {
            if (!alive) return;
            setQrState(state);
            if (state === "approved") {
              // Сессия уже в куках — поднимаем приложение обычным путём.
              window.location.replace(window.location.pathname);
            }
            if (state !== "pending") {
              clearInterval(poll);
              clearInterval(tick);
            }
          });
        }, 2000);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => { alive = false; clearInterval(poll); clearInterval(tick); };
  }, [step, again]);

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
          {step === "qr" ? "Вход через Telegram" : step === "email" ? "Вход по почте" : "Код из письма"}
        </h2>
        <p className="t-sub mt-1.5">
          {step === "qr"
            ? "Наведите камеру телефона на код — откроется чат с ботом. Подтвердите вход кнопкой, и страница откроется сама."
            : step === "email"
              ? `Работает та почта, которую вы привязали в ${APP_NAME} внутри Telegram: кабинет → «Почта для входа».`
              : `Отправили шестизначный код на ${email.trim()}. Письмо приходит за минуту, иногда попадает в «Промоакции».`}
        </p>

        {step === "qr" ? (
          <>
            <div className="mt-5 flex flex-col items-center">
              <div className="relative flex h-[240px] w-[240px] items-center justify-center rounded-[20px] bg-white p-3 stroke">
                {qr ? (
                  <img src={qr.image} alt="QR-код для входа" className="h-full w-full" />
                ) : (
                  <span className="t-cap">{error ? "Код не выдался" : "Готовим код…"}</span>
                )}
                {(qrState === "rejected" || qrState === "expired" || qrState === "used" || left === 0) && qr && (
                  <button
                    onClick={() => setAgain((v) => v + 1)}
                    className="absolute inset-3 flex flex-col items-center justify-center gap-2 rounded-[15px] text-[13px] font-black"
                    style={{ background: "rgba(255,255,255,.93)" }}
                  >
                    <Icon name="swap" width={20} weight="bold" color="var(--accent)" />
                    {qrState === "rejected" ? "Вход отклонён. Показать новый код" : "Код устарел. Показать новый"}
                  </button>
                )}
              </div>
              <p className="t-cap mt-3 text-center">
                {qrState === "approved"
                  ? "Подтверждено, открываем…"
                  : left > 0
                    ? `Код действует ещё ${left} с`
                    : "Обновите код, чтобы войти"}
              </p>
            </div>

            {/* С телефона камеру на собственный экран не навести — там та же
                ссылка открывается нажатием. */}
            {qr && (
              <a href={qr.link} target="_blank" rel="noreferrer" className="btn btn-white mt-3 w-full py-3">
                <Icon name="telegram" width={16} weight="fill" color="var(--accent)" /> Открыть Telegram на этом устройстве
              </a>
            )}
            <button onClick={() => { setStep("email"); setError(""); }} className="mt-3 w-full py-2 text-[13px] font-bold text-[var(--muted)]">
              Войти по почте
            </button>
          </>
        ) : step === "email" ? (
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
            {!DEMO && (
              <button onClick={() => { setStep("qr"); setError(""); }} className="mt-3 w-full py-2 text-[13px] font-bold text-[var(--muted)]">
                Войти через Telegram
              </button>
            )}
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
