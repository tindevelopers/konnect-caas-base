"use server";

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";
import { requirePermission } from "@/core/permissions/middleware";

type OrganizationAdmin = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { 
    id: string;
    name: string;
    description: string;
    permissions: string[];
  } | null;
  tenants?: { 
    id: string;
    name: string;
    domain: string;
    status: string;
  } | null;
};

/**
 * Check if current user is a Platform Admin (server-side)
 */
async function isPlatformAdminServer(): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return false;

    const adminClient = createAdminClient();
    const userResult: { data: { role_id: string | null; tenant_id: string | null; roles: { name: string } | null } | null; error: any } = await adminClient
      .from("users")
      .select("role_id, tenant_id, roles:role_id(name)")
      .eq("id", user.id)
      .single();

    const currentUser = userResult.data;
    const queryError = userResult.error;

    if (queryError || !currentUser) return false;

    const roleName = (currentUser.roles as any)?.name;
    const tenantId = currentUser.tenant_id;
    return roleName === "Platform Admin" && tenantId === null;
  } catch (error) {
    console.error("[isPlatformAdminServer] Error:", error);
    return false;
  }
}

/**
 * Get all Organization Admins (Organization Admins) across all tenants
 * Only accessible by Platform Admins
 * Server action version
 */
export async function getAllOrganizationAdmins(): Promise<OrganizationAdmin[]> {
  // Check permission - only Platform Admins can view Organization Admins
  await requirePermission("users.read");
  
  try {
    // Check if current user is Platform Admin
    const adminStatus = await isPlatformAdminServer();
    if (!adminStatus) {
      throw new Error("Only Platform Admins can view all Organization Admins");
    }

    // Get all Organization Admins with tenant info
    // Use admin client to bypass RLS for this query
    const adminClient = createAdminClient();
    
    // First get the Organization Admin role ID
    const roleResult: { data: { id: string } | null; error: any } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", "Organization Admin")
      .single();

    const workspaceAdminRole = roleResult.data;
    if (!workspaceAdminRole) {
      throw new Error("Organization Admin role not found");
    }

    // Get all Organization Admins (tenant-scoped users only)
    const queryResult: { data: any[] | null; error: any } = await adminClient
      .from("users")
      .select(`
        *,
        roles:role_id (
          id,
          name,
          description,
          permissions
        ),
        tenants:tenant_id (
          id,
          name,
          domain,
          status
        )
      `)
      .not("tenant_id", "is", null)  // Only tenant-scoped users
      .eq("role_id", workspaceAdminRole.id)  // Organization Admin role
      .order("created_at", { ascending: false });

    const data = queryResult.data;
    const error = queryResult.error;

    if (error) {
      console.error("[getAllOrganizationAdmins] Error fetching Organization Admins:", error);
      throw error;
    }
    
    return (data || []) as OrganizationAdmin[];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[getAllOrganizationAdmins] Error:", errorMessage);
    throw error;
  }
}

/**
 * Check if current user is Platform Admin (server action)
 */
export async function isPlatformAdmin(): Promise<boolean> {
  return await isPlatformAdminServer();
}

