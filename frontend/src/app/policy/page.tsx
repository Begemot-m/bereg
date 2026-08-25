import type { Metadata } from "next";
import Link from "next/link";

import { PolicyBody } from "@/components/policy-sheet";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных",
  description:
    "Как платформа «Хроника» собирает, хранит и защищает персональные данные психологов и клиентов: состав данных, сроки хранения и права пользователя.",
  alternates: { canonical: "/policy" },
};

const VERSION = process.env.POLICY_VERSION ?? "2026-07-01";

/**
 * Публичная политика. Живёт в коде, а не в базе: версия документа зашита в
 * согласия, и текст должен меняться вместе с ней одним коммитом. Сам текст —
 * в `components/policy-sheet.tsx`: его же показывает лист внутри знакомства,
 * и расходиться этим двум местам нельзя.
 *
 * Это рабочая заготовка под ваши реквизиты — перед запуском вычитать с
 * юристом, особенно разделы про сроки хранения и передачу третьим лицам.
 */
export default function PolicyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-5 pb-16 pt-4">
      <header>
        <Link href="/cabinet" className="back-link mb-1">Назад</Link>
        <h1 className="t-display">Политика обработки персональных данных</h1>
        <p className="t-cap mt-1.5">Редакция от {VERSION}</p>
      </header>
      <PolicyBody />
    </article>
  );
}
