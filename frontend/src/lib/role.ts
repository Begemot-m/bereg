"use client";

import { useEffect, useState } from "react";

export type Role = "guest" | "client" | "psychologist";

export const ROLE_LABEL: Record<Role, string> = {
  guest: "Гость",
  client: "Клиент",
  psychologist: "Психолог",
};

const KEY = "psy_demo_role";
const EVENT = "opora-role-change";

export function getRole(): Role {
  if (typeof window === "undefined") return "psychologist";
  return (localStorage.getItem(KEY) as Role) || "psychologist";
}

export function setRole(role: Role) {
  localStorage.setItem(KEY, role);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useRole(): [Role, (r: Role) => void] {
  const [role, setLocal] = useState<Role>("psychologist");

  useEffect(() => {
    setLocal(getRole());
    const onChange = () => setLocal(getRole());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  return [role, setRole];
}
