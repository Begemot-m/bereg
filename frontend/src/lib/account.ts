import { apiFetch } from "@/lib/api";

export type AccountEmail = { email: string | null; verified: boolean; message?: string; canConfirm?: boolean };

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export const getAccountEmail = () => apiFetch<AccountEmail>("/my/email");

export const bindAccountEmail = (email: string) => apiFetch<AccountEmail>("/my/email", {
  method: "PUT",
  body: JSON.stringify({ email }),
});

export const confirmAccountEmail = () => apiFetch<AccountEmail>("/my/email", { method: "POST" });

export const unbindAccountEmail = () => apiFetch<void>("/my/email", { method: "DELETE" });
