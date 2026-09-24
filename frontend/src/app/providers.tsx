"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // В вебвью Telegram фокус срабатывает на открытие клавиатуры:
            // каждый тап в поле дёргал перезапрос всех активных запросов и
            // подвешивал набор текста. В браузере всё наоборот — вкладка висит
            // часами, и без обновления по возврату веб показывал бы одно, а
            // мини-приложение другое. Решаем в момент фокуса, а не при создании
            // клиента: флаг на <html> к тому времени уже точный.
            refetchOnWindowFocus: () => document.documentElement.dataset.web === "1",
            // Повторное открытие раздела не должно ходить в сеть заново:
            // данные меняет сам пользователь, и после каждой мутации мы их
            // инвалидируем явно. Минута — компромисс между «всегда свежо»
            // и «не ждать спиннер на каждом переходе».
            staleTime: 60_000,
            // Кэш переживает уход со страницы: вернулись в раздел — данные
            // уже на экране, обновление идёт фоном.
            gcTime: 10 * 60_000,
            // По умолчанию три повтора с нарастающей паузой: одна упавшая
            // ручка держала экран в загрузке около семи секунд.
            retry: 1,
            retryDelay: 400,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
