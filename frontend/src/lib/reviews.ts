import { apiFetch } from "@/lib/api";

export type Review = { rating: number; text: string; authorName: string; createdAt: string; mine: boolean };
export type Reviews = { rating: number; count: number; list: Review[] };

export const getReviews = (psychologistId: number) => apiFetch<Reviews>(`/reviews?psy=${psychologistId}`);

export const rateTherapist = (psychologistId: number, rating: number, text = "") =>
  apiFetch<Reviews>("/reviews", { method: "POST", body: JSON.stringify({ psychologistId, rating, text }) });
