import { apiFetch } from "@/lib/api";

export type ReminderSettings = { reminder24h: true; reminder2h: boolean };

export const getReminderSettings = () => apiFetch<ReminderSettings>("/my/reminders");
export const setReminderSettings = (reminder2h: boolean) =>
  apiFetch<ReminderSettings>("/my/reminders", { method: "PUT", body: JSON.stringify({ reminder2h }) });
