"use client";

import { useEffect, useState } from "react";

import { asset } from "@/lib/asset";

// Настроение 1..5 → эмоция маскота.
export const MOOD_KEY = ["", "very-bad", "bad", "neutral", "good", "great"] as const;
export const MOOD_LABEL = ["", "тяжело", "непросто", "ровно", "неплохо", "отлично"] as const;

export type Animal = { key: string; name: string };
export const ANIMALS: Animal[] = [
  { key: "cat", name: "Котик" }, { key: "dog", name: "Пёсик" }, { key: "fox", name: "Лисёнок" },
  { key: "bear", name: "Мишка" }, { key: "panda", name: "Панда" }, { key: "rabbit", name: "Зайка" },
  { key: "monkey", name: "Обезьянка" }, { key: "pig", name: "Свинка" }, { key: "frog", name: "Лягушка" },
  { key: "chicken", name: "Цыплёнок" }, { key: "owl", name: "Совёнок" }, { key: "butterfly", name: "Бабочка" }, { key: "bee", name: "Пчёлка" },
];
export const animalName = (key: string) => ANIMALS.find((a) => a.key === key)?.name ?? "Котик";
export const mascotSrc = (animal: string, mood: number) => asset(`/mascots/${animal}-${MOOD_KEY[mood]}.png`);

const KEY = "bereg_mood_animal";
const EVENT = "bereg-animal-change";
export function getAnimal(): string {
  if (typeof window === "undefined") return "cat";
  return localStorage.getItem(KEY) || "cat";
}
export function setAnimal(a: string) {
  localStorage.setItem(KEY, a);
  window.dispatchEvent(new CustomEvent(EVENT));
}
export function useAnimal(): [string, (a: string) => void] {
  const [a, setA] = useState("cat");
  useEffect(() => {
    setA(getAnimal());
    const on = () => setA(getAnimal());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [a, (next: string) => { setAnimal(next); setA(next); }];
}
