import crypto from "node:crypto";

// Серверная валидация Telegram Mini App initData (порт с Python-версии).
//   secret_key    = HMAC_SHA256(key="WebAppData", msg=bot_token)
//   computed_hash = HMAC_SHA256(key=secret_key, msg=data_check_string)
// Никогда не доверяем данным клиента: пользователь берётся только отсюда.

export class InitDataError extends Error {}

export type TelegramUser = {
  telegramId: bigint;
  username: string | null;
  firstName: string | null;
};

export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
): TelegramUser {
  if (!initData) throw new InitDataError("empty initData");

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new InitDataError("missing hash");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(receivedHash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new InitDataError("bad signature");
  }

  const authDate = params.get("auth_date");
  if (!authDate) throw new InitDataError("missing auth_date");
  if (Date.now() / 1000 - Number(authDate) > maxAgeSeconds) {
    throw new InitDataError("initData expired");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new InitDataError("missing user");
  const user = JSON.parse(userRaw) as { id: number; username?: string; first_name?: string };

  return {
    telegramId: BigInt(user.id),
    username: user.username ?? null,
    firstName: user.first_name ?? null,
  };
}
