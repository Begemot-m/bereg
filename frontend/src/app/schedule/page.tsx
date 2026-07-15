"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ScheduleRedirect() {
  const r = useRouter();
  useEffect(() => { r.replace("/sessions"); }, [r]);
  return null;
}
