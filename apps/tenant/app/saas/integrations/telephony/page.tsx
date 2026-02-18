import { redirect } from "next/navigation";

export default function TelephonyIntegrationsPage() {
  redirect("/saas/integrations/list?category=Telephony");
}
