"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// Пересоздаётся при каждой навигации — мягкий, быстрый вход экрана.
// Блюр маскирует смену контента; ease-out даёт мгновенный отклик.
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
