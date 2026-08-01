"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientNotesDetail } from "@/components/session-reflections";
import { TherapyDetailShell } from "@/components/therapy-detail-shell";
import { SkeletonRow } from "@/components/ui";
import { listMyBookings } from "@/lib/clients";
import { getMyTherapy, updateMyTherapy } from "@/lib/therapy";

export default function ClientNotesPage() {
  const qc = useQueryClient();
  const meetings = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings });
  const therapy = useQuery({ queryKey: ["my-therapy"], queryFn: getMyTherapy });
  const save = useMutation({ mutationFn: updateMyTherapy, onSuccess: (state) => qc.setQueryData(["my-therapy"], state) });
  if (meetings.isLoading || therapy.isLoading || !therapy.data) return <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>;
  return <TherapyDetailShell backHref="/therapy" backLabel="Назад в терапию" title="Заметки" subtitle="Подготовка, итоги и динамика встреч" icon="note"><ClientNotesDetail meetings={meetings.data ?? []} reflections={therapy.data.reflections} module={therapy.data.notesModule} saving={save.isPending} onSave={(reflection) => save.mutate({ reflection })} onModuleChange={(notesModule) => save.mutate({ notesModule })} /></TherapyDetailShell>;
}
