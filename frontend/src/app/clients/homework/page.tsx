"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PageHead } from "@/components/blocks";
import { PsychologistHomeworkDetail } from "@/components/psychologist-homework";
import { SkeletonRow } from "@/components/ui";
import { getClient, listHomework } from "@/lib/clients";
import { tap } from "@/lib/haptics";

export default function PsychologistHomeworkPage() {
  return <Suspense fallback={<div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>}><PsychologistHomeworkScreen /></Suspense>;
}

function PsychologistHomeworkScreen() {
  const id = Number(useSearchParams().get("id"));
  const qc = useQueryClient();
  const client = useQuery({ queryKey: ["client", id], queryFn: () => getClient(id), enabled: id > 0 });
  const homework = useQuery({ queryKey: ["homework", id], queryFn: () => listHomework(id), enabled: id > 0 });
  if (client.isLoading || homework.isLoading || !client.data) return <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>;
  return <div><Link href={`/clients/?id=${id}`} onClick={tap} className="back-link mb-3">Назад к клиенту</Link><PageHead title="Задания" sub={client.data.name} icon="book" /><PsychologistHomeworkDetail clientId={id} items={homework.data ?? []} onChanged={() => void qc.invalidateQueries({ queryKey: ["homework", id] })} /></div>;
}
