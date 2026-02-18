import { redirect } from "next/navigation";

export default function OAuthAppsPage() {
  redirect("/saas/integrations/list");
}
