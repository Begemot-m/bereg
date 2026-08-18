"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Icon, type IconName } from "@/components/icons";
import { tap } from "@/lib/haptics";

/**
 * Вопрос перед действием с записью: подтвердить, отклонить, перенести,
 * освободить окно. Один вид на обе стороны — специалист и клиент видят одно и
 * то же окно, меняются только слова и тон кнопки.
 */
export type AskSpec = {
  title: string;
  /** Время встречи, о которой спрашиваем. */
  when?: string;
  note?: string;
  confirm: string;
  tone?: "danger" | "green" | "accent";
  icon?: IconName;
  run: () => void;
};

const TONE: Record<NonNullable<AskSpec["tone"]>, string> = {
  danger: "var(--danger)",
  green: "var(--green-edge)",
  accent: "var(--edge)",
};

export function ConfirmAsk({ spec, onClose }: { spec: AskSpec | null; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  const color = TONE[spec?.tone ?? "accent"];

  // Рисуем в body, а не внутри страницы: иначе окно оказывается в слое
  // `.sheet` и блоки под затемнением продолжают светиться поверх него.
  return createPortal(
    <AnimatePresence>
      {spec && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { tap(); onClose(); }}
          className="fixed inset-0 z-[85] flex items-end justify-center p-3"
          style={{ background: "rgba(32,28,24,.44)", backdropFilter: "blur(2px)" }}
        >
          <motion.div
            initial={{ y: 42 }}
            animate={{ y: 0 }}
            exit={{ y: 42, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="chunk w-full max-w-md p-5"
            style={{ background: "var(--surface)" }}
          >
            <div className="flex items-start gap-3">
              <span className="ico h-11 w-11 shrink-0" style={{ background: color }}>
                <Icon name={spec.icon ?? "calendar"} width={20} weight="bold" color="#fff" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-tight text-[18px] font-black leading-tight">{spec.title}</p>
                {spec.when && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-black" style={{ color }}>
                    <Icon name="clock" width={13} weight="bold" color={color} />
                    {spec.when}
                  </p>
                )}
                {spec.note && <p className="t-body mt-1.5">{spec.note}</p>}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => { tap(); onClose(); }} className="btn btn-white flex-1 py-2.5">Не сейчас</button>
              <button
                onClick={() => { tap(); spec.run(); onClose(); }}
                className="btn flex-1 py-2.5"
                style={{ background: color, borderColor: color }}
              >
                {spec.confirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Экран отдаёт `askNode` в разметку, а действие вешает на `ask({...})`:
 * мутация запускается только после ответа «да» в окне.
 */
export function useConfirmAsk(): { ask: (spec: AskSpec) => void; askNode: ReactNode } {
  const [spec, setSpec] = useState<AskSpec | null>(null);
  const ask = useCallback((next: AskSpec) => setSpec(next), []);
  return { ask, askNode: <ConfirmAsk spec={spec} onClose={() => setSpec(null)} /> };
}
