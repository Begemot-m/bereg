import type { ReactNode } from "react";

import { LEGAL } from "@/lib/legal";

export function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-5 pb-16 pt-4">
      <header>
        <h1 className="t-display">{title}</h1>
        <p className="t-cap mt-1.5">Редакция от {LEGAL.version}</p>
      </header>
      {children}
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="t-head">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="t-body">{children}</p>;
}

export function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul className="t-body list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Requisites() {
  return (
    <Section title="Реквизиты исполнителя">
      <Ul
        items={[
          <>Исполнитель — {LEGAL.operator}, {LEGAL.status}</>,
          <>ИНН {LEGAL.inn}</>,
          <>На учёте в качестве плательщика НПД с {LEGAL.registeredSince}</>,
          <>{LEGAL.address ? <>Адрес: {LEGAL.address}</> : <>Адрес для корреспонденции — по запросу на почту</>}</>,
          <>Почта: {LEGAL.email}</>,
          <>Сервис «{LEGAL.service}»: {LEGAL.site}, а также приложение в Telegram</>,
        ]}
      />
    </Section>
  );
}
