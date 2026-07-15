"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BillingRedirect() {
  const r = useRouter();
  useEffect(() => { r.replace("/cabinet"); }, [r]);
  return null;
}
