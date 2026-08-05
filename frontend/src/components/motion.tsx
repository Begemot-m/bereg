"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.32, 0.72, 0, 1] as const;

// Тяжёлое появление с блюром — по протоколу скролл-интерполяции.
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.3, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

// Каскад держал последнюю карточку экрана невидимой почти секунду — раздел
// казался медленным, хотя данные были уже на руках.
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
