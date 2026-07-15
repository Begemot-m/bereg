import { redirect } from "next/navigation";

// Раздел переехал в «Мои сессии».
export default function ScheduleRedirect() {
  redirect("/sessions");
}
