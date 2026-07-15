import { apiFetch } from "@/lib/api";

export type Stats = {
  periodDays: number;
  sessions: number;
  done: number;
  hours: number;
  clientsActive: number;
};

export const getStats = (days = 30) => apiFetch<Stats>(`/stats?days=${days}`);
