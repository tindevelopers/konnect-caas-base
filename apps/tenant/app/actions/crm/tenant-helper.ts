"use server";

import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";

/**
 * Get tenant ID for CRM operations
 * For Platform Admins (tenant_id = NULL), returns the first available tenant
 * For regular users, returns their tenant_id
 * Throws error if no tenant can be found
 */
export async function getTenantForCrm(): Promise<string> {
  const tenantId = await getCurrentTenant();
  
  if (tenantId) {
    return tenantId;
  }

  // If no tenant_id, check if user is Platform Admin
  // Use admin client to bypass RLS when checking user role
  const adminClient = createAdminClient();
  
  // First, get the authenticated user from regular client
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error("[getTenantForCrm] Auth error:", authError);
    // If auth fails, try to get user from admin client using session
    // This is a fallback for cases where regular client doesn't have session
    throw new Error("You must be logged in to perform CRM operations. Please sign in and try again.");
  }

  console.log(`[getTenantForCrm] Authenticated user: ${user.email} (${user.id})`);

  // Use admin client to get user data (bypasses RLS)
  const { data: userData, error: userError } = await (adminClient.from("users") as any)
    .select("role_id, tenant_id, roles:role_id(name)")
    .eq("id", user.id)
    .single();

  if (userError || !userData) {
    console.error("[getTenantForCrm] Error fetching user data:", userError);
    throw new Error(`Failed to fetch user data: ${userError?.message || "User not found in users table"}`);
  }

  const roleName = (userData.roles as any)?.name;
  const isPlatformAdmin = roleName === "Platform Admin" && userData.tenant_id === null;
  
  console.log(`[getTenantForCrm] User check: role=${roleName}, tenant_id=${userData.tenant_id || "NULL"}, isPlatformAdmin=${isPlatformAdmin}`);

  if (isPlatformAdmin) {
    // Platform Admin: Get the first available tenant (adminClient already declared above)
    console.log("[getTenantForCrm] Platform Admin detected, fetching tenants...");
    
    // Get all tenants and pick the first one
    const { data: tenants, error } = await (adminClient.from("tenants") as any)
      .select("id, name, domain")
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) {
      console.error("[getTenantForCrm] Error fetching tenants:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(
        `Failed to fetch tenants: ${error.message}. Please ensure you have created at least one tenant. ` +
        `If tenants exist, this may be a database permissions issue.`
      );
    }

    console.log(`[getTenantForCrm] Found ${tenants?.length || 0} tenant(s)`);

    if (!tenants || tenants.length === 0) {
      // No tenants exist - Platform Admin needs to create one first
      throw new Error(
        "No tenants found. As a Platform Admin, you need to create a tenant first before creating CRM records. " +
        "Please go to Tenant Management (/saas/admin/entity/tenant-management) and create a tenant."
      );
    }

    const selectedTenant = tenants[0];
    console.log(`[getTenantForCrm] Platform Admin using tenant: ${selectedTenant.id} (${selectedTenant.name || selectedTenant.domain})`);
    return selectedTenant.id;
  }

  throw new Error(
    "No tenant found. Please ensure you are associated with a tenant. " +
    "If you are a Platform Admin, please create a tenant first in Tenant Management."
  );
}
