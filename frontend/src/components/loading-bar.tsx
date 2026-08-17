"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";

// Тонкая тиффани-полоса под чёлкой. Экран часто отрисован из кэша, а данные ещё
// едут — без неё приложение выглядит замершим. Появляется на любой активный
// запрос или мутацию и уходит сама; в демо запросы почти мгновенные, и полоса
// просто не успевает показаться.
export function LoadingBar() {
  const busy = useIsFetching() + useIsMutating();

  return (
    <AnimatePresence>
      {busy > 0 && (
        <motion.div
          key="loading-bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="pointer-events-none absolute inset-x-0 z-30 h-[3px] overflow-hidden"
          style={{ top: "var(--top-pad, 0px)" }}
          aria-hidden
        >
          <span className="load-bar block h-full w-full" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
