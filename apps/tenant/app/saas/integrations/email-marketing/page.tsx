import { redirect } from "next/navigation";

export default function EmailIntegrationsPage() {
  redirect("/saas/integrations/list?category=Email");
}
