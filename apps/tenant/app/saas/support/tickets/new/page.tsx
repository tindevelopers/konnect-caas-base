import TicketForm from "@/components/support/TicketForm";
import { getAllSupportCategories } from "@/app/actions/support/categories";
import { createClient } from "@/core/database/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";

export default async function NewTicketPage() {
  const categories = await getAllSupportCategories();
  
  // Get users for assignment (agents in the tenant)
  const supabase = await createClient();
  const tenantId = await getCurrentTenant();
  
  let agents: Array<{ id: string; full_name: string; email: string }> = [];
  if (tenantId) {
    const { data } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .limit(100);
    agents = data || [];
  }

  return <TicketForm categories={categories} agents={agents} />;
}

