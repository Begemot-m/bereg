"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PsychologistHomeworkDetail } from "@/components/psychologist-homework";
import { TherapyDetailShell } from "@/components/therapy-detail-shell";
import { SkeletonRow } from "@/components/ui";
import { getClient, listHomework } from "@/lib/clients";

export default function PsychologistHomeworkPage() {
  return <Suspense fallback={<div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>}><PsychologistHomeworkScreen /></Suspense>;
}

function PsychologistHomeworkScreen() {
  const id = Number(useSearchParams().get("id"));
  const qc = useQueryClient();
  const client = useQuery({ queryKey: ["client", id], queryFn: () => getClient(id), enabled: id > 0 });
  const homework = useQuery({ queryKey: ["homework", id], queryFn: () => listHomework(id), enabled: id > 0 });
  if (client.isLoading || homework.isLoading || !client.data) return <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>;
  return <TherapyDetailShell backHref={`/clients/?id=${id}`} backLabel="Назад к клиенту" title="Задания" subtitle={client.data.name} icon="book" accent="purple"><PsychologistHomeworkDetail clientId={id} items={homework.data ?? []} onChanged={() => void qc.invalidateQueries({ queryKey: ["homework", id] })} /></TherapyDetailShell>;
}
