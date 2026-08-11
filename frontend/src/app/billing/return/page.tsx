"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";

import { PageHead } from "@/components/blocks";
import { Reveal } from "@/components/motion";
import { Button, Card, Spinner } from "@/components/ui";
import { confirmSubscription, getSubscription } from "@/lib/subscription";

export default function BillingReturn() {
  const { data: sub, refetch } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const active = sub?.status === "active";

  // Сами спрашиваем ЮKassa о судьбе платежа, а не ждём вебхук: он приходит на
  // секунды позже, и человек не должен видеть спиннер дольше, чем нужно.
  useEffect(() => {
    if (active) return;
    let stop = false;
    const tick = async () => {
      try {
        await confirmSubscription();
      } catch {
        // Не ответили — попробуем на следующем такте.
      }
      if (!stop) await refetch();
    };
    void tick();
    const t = setInterval(() => void tick(), 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [refetch, active]);

  return (
    <div>
      <PageHead title="Оплата" sub="ЮKassa" />
      <Reveal delay={0.05}>
        <Card>
          {active ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[var(--green-edge)]">Подписка Pro активирована. Спасибо!</p>
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
