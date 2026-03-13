import { redirect } from "next/navigation";

export default function CrmIntegrationsPage() {
  redirect("/saas/integrations/list?category=CRM");
}
