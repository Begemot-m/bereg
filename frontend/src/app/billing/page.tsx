import { redirect } from "next/navigation";

// Управление подпиской переехало в личный кабинет.
export default function BillingRedirect() {
  redirect("/cabinet");
}
