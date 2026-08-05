"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PsychologistNotesDetail } from "@/components/session-reflections";
import { TherapyDetailShell } from "@/components/therapy-detail-shell";
import { SkeletonRow } from "@/components/ui";
import { listAppointments } from "@/lib/appointments";
import { getClient } from "@/lib/clients";
import { getClientTherapy, setClientNotesModule } from "@/lib/therapy";

export default function PsychologistNotesPage() {
  return <Suspense fallback={<div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>}><PsychologistNotesScreen /></Suspense>;
}

function PsychologistNotesScreen() {
  const id = Number(useSearchParams().get("id"));
  const qc = useQueryClient();
  const client = useQuery({ queryKey: ["client", id], queryFn: () => getClient(id), enabled: id > 0 });
  const meetings = useQuery({ queryKey: ["appointments", id], queryFn: () => listAppointments(id), enabled: id > 0 });
  const therapy = useQuery({ queryKey: ["client-therapy", id], queryFn: () => getClientTherapy(id), enabled: id > 0 });
  const toggle = useMutation({ mutationFn: (enabled: boolean) => setClientNotesModule(id, enabled), onSuccess: (state) => qc.setQueryData(["client-therapy", id], state) });
  if (client.isLoading || meetings.isLoading || therapy.isLoading || !client.data || !therapy.data) return <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>;
  return <TherapyDetailShell backHref={`/clients/?id=${id}`} backLabel="Назад к клиенту" title="Заметки о встречах" subtitle={client.data.name} icon="note"><PsychologistNotesDetail meetings={meetings.data ?? []} reflections={therapy.data.reflections} module={therapy.data.notesModule} saving={toggle.isPending} onToggle={() => toggle.mutate(!therapy.data!.notesModule.psychologistEnabled)} /></TherapyDetailShell>;
}
