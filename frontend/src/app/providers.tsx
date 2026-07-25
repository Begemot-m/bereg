"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Раньше стояло refetchOnWindowFocus: в вебвью фокус срабатывает на
            // открытие клавиатуры, поэтому каждый тап в поле дёргал перезапрос
            // всех активных запросов и подвешивал набор текста. Данные и так
            // инвалидируются явно после мутаций.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
