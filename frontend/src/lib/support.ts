import { apiFetch } from "@/lib/api";

export const sendSupport = (kind: string, text: string) =>
  apiFetch<{ id: number }>("/support", { method: "POST", body: JSON.stringify({ kind, text }) });
