// Отправка почты через SMTP.
//
// Выбран SMTP, а не API конкретного сервиса: он есть у любого хостера и
// у Яндекс 360, и при смене провайдера меняются только переменные окружения,
// а не код. Транспорт создаётся один раз — переподключение на каждое письмо
// съедает секунду на рукопожатии TLS.

import { createTransport, type Transporter } from "nodemailer";

let cached: Transporter | null = null;

function transport(): Transporter | null {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  cached = createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 2,
  });
  return cached;
}

export function mailReady(): boolean {
  return transport() !== null;
}

type Letter = { to: string; subject: string; text: string };

/**
 * Отправить письмо. Без настроенного SMTP пишем в лог — в разработке это
 * удобнее, чем поднимать почтовый сервер, и код входа видно сразу.
 */
export async function sendMail({ to, subject, text }: Letter): Promise<void> {
  const t = transport();
  if (!t) {
    console.info(JSON.stringify({ level: "info", mail: "not_configured", to, subject, text }));
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM ?? `Методика <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}

/** Письмо с одноразовым кодом. Текстом, без картинок: так не улетает в спам. */
export function otpLetter(code: string): { subject: string; text: string } {
  return {
    subject: `Код входа: ${code}`,
    text: [
      `Ваш код для входа в «Методику»: ${code}`,
      "",
      "Код действует 10 минут и подходит только для одного входа.",
      "Если вы его не запрашивали — просто удалите это письмо, в аккаунт никто не вошёл.",
    ].join("\n"),
  };
}
