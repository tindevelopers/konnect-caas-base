import { redirect } from "next/navigation";

export default function PaymentsIntegrationsPage() {
  redirect("/saas/integrations/list?category=Payments");
}
