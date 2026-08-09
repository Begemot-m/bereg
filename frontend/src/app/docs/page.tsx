import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL, LEGAL_DOCS } from "@/lib/legal";

export const metadata: Metadata = { title: "Документы — Хроника" };

export default function DocsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-5 pb-16 pt-4">
      <header>
        <h1 className="t-display">Документы</h1>
        <p className="t-cap mt-1.5">Редакция от {LEGAL.version}</p>
      </header>

      <div className="overflow-hidden rounded-[18px] bg-white stroke">
        {LEGAL_DOCS.map((doc, i) => (
          <Link
            key={doc.href}
            href={doc.href}
            className={`block px-4 py-3 ${i > 0 ? "line-top" : ""}`}
          >
            <span className="t-head">{doc.title}</span>
            <span className="t-cap mt-0.5 block">{doc.hint}</span>
          </Link>
        ))}
      </div>

      <section className="space-y-1.5">
        <h2 className="t-head">Реквизиты</h2>
        <p className="t-body">
          {LEGAL.operator}, {LEGAL.status}, ИНН {LEGAL.inn}. Сервис «{LEGAL.service}» — {LEGAL.site} и приложение
          в Telegram. Связь: {LEGAL.email} или раздел «Отдел заботы» в приложении.
        </p>
      </section>
    </article>
  );
}
