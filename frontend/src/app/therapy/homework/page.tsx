"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { TherapyDetailShell } from "@/components/therapy-detail-shell";
import { ClientHomeworkDetail } from "@/components/therapy-work";
import { SkeletonRow } from "@/components/ui";
import { listHomework } from "@/lib/clients";

export default function ClientHomeworkPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["my-homework"], queryFn: () => listHomework(1) });
  if (query.isLoading) return <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>;
  return <TherapyDetailShell backHref="/therapy" backLabel="Назад в терапию" title="Задания" subtitle="Активные задания и история" icon="book" accent="purple"><ClientHomeworkDetail homework={query.data ?? []} onChanged={() => void qc.invalidateQueries({ queryKey: ["my-homework"] })} /></TherapyDetailShell>;
}
