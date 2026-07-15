"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";

import { PageHead } from "@/components/blocks";
import { Reveal } from "@/components/motion";
import { Button, Card, Spinner } from "@/components/ui";
import { getSubscription } from "@/lib/subscription";

export default function BillingReturn() {
  const { data: sub, refetch } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });

  useEffect(() => {
    const t = setInterval(() => refetch(), 3000);
    return () => clearInterval(t);
  }, [refetch]);

  const active = sub?.status === "active";

  return (
    <div>
      <Reveal><PageHead title="Оплата" sub="ЮKassa" /></Reveal>
      <Reveal delay={0.05}>
        <Card>
          {active ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[#0a3d28]">Подписка Pro активирована. Спасибо!</p>
              <Link href="/cabinet"><Button arrow>В кабинет</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              <Spinner label="Ждём подтверждения от ЮKassa" />
              <p className="text-[12px] text-[var(--muted-2)]">Обычно несколько секунд. Страница обновится сама.</p>
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
