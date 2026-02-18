import { redirect } from "next/navigation";

export default function ApiConnectionsIntegrationsPage() {
  redirect("/saas/integrations/list?category=Automation%20/%20Webhooks");
}
