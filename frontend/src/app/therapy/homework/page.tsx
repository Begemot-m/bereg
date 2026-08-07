"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { PageHead } from "@/components/blocks";
import { ClientHomeworkDetail } from "@/components/therapy-work";
import { SkeletonRow } from "@/components/ui";
import { listHomework } from "@/lib/clients";
import { tap } from "@/lib/haptics";

export default function ClientHomeworkPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["my-homework"], queryFn: () => listHomework(1) });
  if (query.isLoading) return <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>;
  return <div><Link href="/therapy" onClick={tap} className="back-link mb-3 mt-3">Назад в терапию</Link><PageHead title="Задания" sub="Активные задания и история" icon="book" /><ClientHomeworkDetail homework={query.data ?? []} onChanged={() => void qc.invalidateQueries({ queryKey: ["my-homework"] })} /></div>;
}
