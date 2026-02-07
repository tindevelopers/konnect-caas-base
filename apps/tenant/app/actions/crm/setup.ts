"use server";

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { getCurrentTenant } from "@/core/multi-tenancy/server";

/**
 * Create a default tenant for the current user if they don't have one
 * This is useful for testing and development
 */
export async function createDefaultTenantForUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  // Check if user already has a tenant
  const existingTenantId = await getCurrentTenant();
  if (existingTenantId) {
    return { success: true, tenantId: existingTenantId, message: "User already has a tenant" };
  }

  // Get user's email to create tenant domain
  const { data: userData } = await (supabase.from("users") as any)
    .select("email, full_name")
    .eq("id", user.id)
    .single();

  if (!userData) {
    throw new Error("User data not found");
  }

  const adminClient = createAdminClient();

  // Create a default tenant
  const tenantDomain = (userData.email as string).split("@")[0] + "-tenant";
  const tenantName = (userData.full_name as string) + "'s Organization";

  const { data: tenant, error: tenantError } = await (adminClient.from("tenants") as any)
    .insert({
      name: tenantName,
      domain: tenantDomain,
      status: "active",
      plan: "free",
      region: "us-east-1",
    })
    .select()
    .single();

  if (tenantError) {
    console.error("Error creating tenant:", tenantError);
    throw tenantError;
  }

  // Update user with tenant_id
  const { error: updateError } = await (adminClient.from("users") as any)
    .update({ tenant_id: (tenant as any).id })
    .eq("id", user.id);

  if (updateError) {
    console.error("Error updating user with tenant_id:", updateError);
    throw updateError;
  }

  return { success: true, tenantId: (tenant as any).id, message: "Default tenant created successfully" };
}
