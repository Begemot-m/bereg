"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Icon } from "@/components/icons";
import { select } from "@/lib/haptics";
import { getReminderSettings, setReminderSettings } from "@/lib/reminders";

// Когда напомнить клиенту о сессии. Живёт в одном блоке с запретом отмены —
// это два правила приёма, а не две разные настройки.
export function RemindersModule() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["reminder-settings"], queryFn: getReminderSettings });
  const save = useMutation({
    mutationFn: setReminderSettings,
    onSuccess: (data) => qc.setQueryData(["reminder-settings"], data),
  });
  const reminder2h = settings.data?.reminder2h ?? false;

  return (
    <div className="flex items-start gap-3">
      <span className="ico ico-mid h-9 w-9 shrink-0"><Icon name="bell" width={18} weight="fill" color="#fff" /></span>
      <div className="min-w-0 flex-1">
        <p className="t-head">За 24 часа</p>
        <p className="t-cap mt-0.5">Обязательное напоминание перед встречей, которое получит клиент</p>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="t-cap min-w-0 flex-1">Дополнительное напоминание за 2 часа до сессии</p>
          <button
            role="switch"
            aria-checked={reminder2h}
            disabled={settings.isLoading || save.isPending}
            onClick={() => { select(); save.mutate(!reminder2h); }}
            className="relative h-4 w-7 shrink-0 rounded-full disabled:opacity-50"
            style={{ background: reminder2h ? "var(--head)" : "var(--surface-2)", border: "var(--bw) solid var(--head)" }}
          >
            <span className="absolute top-[1px] h-[10px] w-[10px] rounded-full bg-white transition-transform" style={{ left: 2, transform: `translateX(${reminder2h ? 11 : 0}px)`, border: "1px solid var(--head)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
