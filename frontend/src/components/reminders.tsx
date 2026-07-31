"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    <div className="card space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="ico ico-accent h-10 w-10 shrink-0">24</span>
        <div className="min-w-0 flex-1"><p className="t-head">За 24 часа</p><p className="t-cap mt-0.5">Обязательное напоминание о каждой сессии</p></div>
        <span className="chip chip-strong">Всегда</span>
      </div>
      <div className="line-top flex items-center gap-3 pt-3">
        <div className="min-w-0 flex-1"><p className="t-head">За 2 часа</p><p className="t-cap mt-0.5">Дополнительное напоминание, если вам так удобнее</p></div>
        <button
          role="switch"
          aria-checked={reminder2h}
          disabled={settings.isLoading || save.isPending}
          onClick={() => { select(); save.mutate(!reminder2h); }}
          className="relative h-7 w-12 shrink-0 rounded-full disabled:opacity-50"
          style={{ background: reminder2h ? "var(--edge)" : "var(--surface-2)", border: "var(--bw) solid var(--edge)" }}
        >
          <span className="absolute top-[2px] h-[19px] w-[19px] rounded-full bg-white transition-transform" style={{ left: 2, transform: `translateX(${reminder2h ? 20 : 0}px)`, border: "1px solid var(--edge)" }} />
        </button>
      </div>
      <p className="t-cap">Бот пришлёт сообщения в Telegram и откроет нужную запись одним нажатием.</p>
    </div>
  );
}
