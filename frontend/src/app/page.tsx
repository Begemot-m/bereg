"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ModuleCard, PageHead, SectionTitle } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { WeekStrip } from "@/components/week-strip";
import { Button, Card } from "@/components/ui";
import { APP_NAME, TAGLINE } from "@/lib/brand";
import { listAppointments } from "@/lib/appointments";
import { listMyBookings } from "@/lib/clients";
import { displayName } from "@/lib/profile";
import { useRole } from "@/lib/role";

const dtf = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const timeF = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}
function useName(): string {
  const [n, setN] = useState("");
  useEffect(() => setN(displayName()), []);
  return n;
}

// Насколько скоро сессия: сегодня / завтра / null
function soon(iso: string): "сегодня" | "завтра" | null {
  const d = new Date(iso), now = new Date();
  const day0 = new Date(now); day0.setHours(0, 0, 0, 0);
  const dd = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - day0.getTime()) / 86400000);
  if (d < now) return null;
  if (dd === 0) return "сегодня";
  if (dd === 1) return "завтра";
  return null;
}

function Reminder({ who, iso }: { who: string; iso: string }) {
  const when = soon(iso);
  if (!when) return null;
  return (
    <Reveal>
      <Link href="/sessions" className="mb-5 block">
        <div className="chunk flex items-center gap-3 p-4" style={{ background: "var(--purple)" }}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] stroke" style={{ background: "#fff" }}>
            <Icon name="bell" width={20} weight="regular" color="var(--ink)" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold">Напоминание · {when} в {timeF.format(new Date(iso))}</p>
            <p className="truncate text-[12px] font-semibold" style={{ color: "rgba(32,28,24,.66)" }}>{who}</p>
          </div>
          <span className="rounded-full px-3 py-1 text-[12px] font-bold stroke" style={{ background: "#fff" }}>Изменить</span>
        </div>
      </Link>
    </Reveal>
  );
}

export default function Home() {
  const [role] = useRole();
  return role === "psychologist" ? <PsyHome /> : <PersonHome guest={role === "guest"} />;
}

function PsyHome() {
  const name = useName();
  const { data: appts = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => listAppointments() });
  const next = appts.find((a) => a.status === "scheduled" && new Date(a.startsAt) > new Date());

  return (
    <div>
      <Reveal>
        <PageHead title={`${greeting()}${name ? `, ${name}` : ""}`} sub="Ваш день в «Тепле»">
          <WeekStrip />
        </PageHead>
      </Reveal>

      {next && <Reminder who={`Сессия с ${next.client.name}`} iso={next.startsAt} />}

      <SectionTitle action={<Link href="/sessions" className="text-[13px] font-bold text-[var(--muted)]">Все →</Link>}>Ближайшая сессия</SectionTitle>
      <Reveal delay={0.05}>
        {next ? (
          <Link href="/sessions" className="group block"><Card interactive>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-lg font-extrabold">{next.client.name}</p><p className="mt-0.5 text-[13px] font-semibold capitalize text-[var(--muted)]">{dtf.format(new Date(next.startsAt))}</p></div>
              <span className="flex h-11 w-11 items-center justify-center rounded-[13px] stroke" style={{ background: "var(--green)" }}><Icon name="calendar" width={20} weight="regular" /></span>
            </div>
          </Card></Link>
        ) : (
          <Card><p className="text-sm text-[var(--muted)]">Запланированных сессий нет. Добавьте в разделе «Сессии».</p></Card>
        )}
      </Reveal>

      <div className="mt-8">
        <SectionTitle>Разделы</SectionTitle>
        <Stagger className="grid grid-cols-2 gap-3">
          <StaggerItem><ModuleCard title="Сессии" desc="Окна и записи" icon="calendar" fill="sage" href="/sessions" /></StaggerItem>
          <StaggerItem><ModuleCard title="Клиенты" desc="Карточки и прогресс" icon="users" fill="iris" href="/clients" /></StaggerItem>
          <StaggerItem><ModuleCard title="Инструменты" desc="В разработке" icon="tools" href="/tools" /></StaggerItem>
          <StaggerItem><ModuleCard title="Кабинет" desc="Профиль и подписка" icon="user" href="/cabinet" /></StaggerItem>
        </Stagger>
      </div>
    </div>
  );
}

function PersonHome({ guest }: { guest: boolean }) {
  const name = useName();
  const { data: bookings = [] } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const next = bookings.find((b) => new Date(b.startsAt) > new Date());

  return (
    <div>
      <Reveal>
        <PageHead title={`${greeting()}${name && !guest ? `, ${name}` : ""}`} sub={TAGLINE}>
          <WeekStrip />
        </PageHead>
      </Reveal>

      {next && <Reminder who={`Сессия · ${next.psyName}`} iso={next.startsAt} />}

      <SectionTitle action={<Link href="/sessions" className="text-[13px] font-bold text-[var(--muted)]">Все →</Link>}>Ваша ближайшая сессия</SectionTitle>
      <Reveal delay={0.05}>
        {next ? (
          <Link href="/sessions" className="group block"><Card interactive>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-lg font-extrabold">{next.psyName}</p><p className="mt-0.5 text-[13px] font-semibold capitalize text-[var(--muted)]">{dtf.format(new Date(next.startsAt))}</p></div>
              <span className="flex h-11 w-11 items-center justify-center rounded-[13px] stroke" style={{ background: "var(--green)" }}><Icon name="calendar" width={20} weight="regular" /></span>
            </div>
          </Card></Link>
        ) : (
          <Card>
            <p className="text-sm text-[var(--muted)]">Записей пока нет. Найдите специалиста в каталоге.</p>
            <Link href="/catalog" className="mt-3 inline-block"><Button size="sm" arrow>Открыть каталог</Button></Link>
          </Card>
        )}
      </Reveal>

      <div className="mt-8">
        <SectionTitle>Разделы</SectionTitle>
        <Stagger className="grid grid-cols-2 gap-3">
          <StaggerItem><ModuleCard title="Мои сессии" desc="Записи к специалистам" icon="calendar" fill="sage" href="/sessions" /></StaggerItem>
          <StaggerItem><ModuleCard title="Каталог" desc="Найти психолога" icon="compass" fill="iris" href="/catalog" /></StaggerItem>
          <StaggerItem><ModuleCard title="Инструменты" desc="В разработке" icon="tools" href="/tools" /></StaggerItem>
          <StaggerItem><ModuleCard title="Кабинет" desc="Роль и настройки" icon="user" href="/cabinet" /></StaggerItem>
        </Stagger>
      </div>
    </div>
  );
}
