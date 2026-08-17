"use client";

import { Icon, type IconName } from "@/components/icons";

type Variant = "invite" | "client" | "psy";

const LINES: Record<Variant, { icon: IconName; text: string }[]> = {
  invite: [
    { icon: "user", text: "Вход — через ваш профиль Telegram: ни паролей, ни регистрации. Так проще, ничего заводить и запоминать не нужно." },
    { icon: "users", text: "Вашу карточку видит только ваш специалист — тот, кто вас пригласил. Другим людям на платформе она не показывается." },
    { icon: "lock", text: "Записи, дневник и заметки хранятся в зашифрованном виде и никуда не передаются." },
  ],
  client: [
    { icon: "user", text: "Вход — через ваш профиль Telegram: ни паролей, ни регистрации. Так проще, ничего заводить и запоминать не нужно." },
    { icon: "users", text: "Вашу карточку видит только тот специалист, к которому вы придёте. Другим людям на платформе она не показывается." },
    { icon: "lock", text: "Записи, дневник и заметки хранятся в зашифрованном виде и никуда не передаются." },
  ],
  psy: [
    { icon: "user", text: "Вход — через ваш профиль Telegram: ни паролей, ни отдельной регистрации." },
    { icon: "users", text: "Карточки клиентов видите только вы. Платформа не показывает их никому другому." },
    { icon: "lock", text: "Записи, заметки и документы хранятся в зашифрованном виде и никуда не передаются." },
  ],
};

/** Что происходит с данными человека — простыми словами, до согласия. */
export function PrivacyNote({ variant, title = "Про ваши данные" }: { variant: Variant; title?: string }) {
  return (
    <div className="rounded-[18px] p-3.5" style={{ background: "var(--purple-soft)" }}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]" style={{ background: "var(--purple-edge)" }}>
          <Icon name="lock" width={14} weight="bold" color="#fff" />
        </span>
        <p className="text-[13px] font-black leading-tight">{title}</p>
      </div>
      <div className="mt-2.5 space-y-2">
        {LINES[variant].map((line) => (
          <div key={line.text} className="flex items-start gap-2.5">
            <Icon name={line.icon} width={14} weight="bold" color="var(--purple-edge)" className="mt-0.5 shrink-0" />
            <p className="text-[11.5px] font-semibold leading-snug" style={{ color: "rgba(32,28,24,.72)" }}>{line.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
