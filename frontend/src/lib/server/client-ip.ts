// Настоящий адрес клиента за обратным прокси.
//
// Caddy дописывает адрес в конец X-Forwarded-For, а не затирает заголовок
// целиком. Поэтому первый элемент списка — это то, что прислал сам клиент:
// брать его нельзя. Раньше брали именно его, и любой запрос со своим
// X-Forwarded-For обходил все лимиты входа и отправки кодов, а в журнале
// аудита и в согласиях на обработку ПД оседал выдуманный адрес.
//
// Последний элемент дописывает ближайший прокси — наш собственный Caddy,
// подделать его через заголовок нельзя. В Caddyfile заголовок вдобавок
// заменяется целиком (header_up X-Forwarded-For {remote_host}), так что
// список из одного адреса — это тоже он.

export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (chain.length) return chain[chain.length - 1];
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

/** То же самое, но для ключей лимитов: там нужна строка, а не null. */
export const clientIpKey = (req: Request): string => clientIp(req) ?? "unknown";
