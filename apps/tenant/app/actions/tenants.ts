"use server";

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";
import { isPlatformAdmin } from "./organization-admins";
import { requirePermission } from "@/core/permissions/middleware";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"] & {
  userCount?: number;
  workspaceCount?: number;
};

/**
 * Get all tenants that the current user has access to
 * 
 * BEST PRACTICE SECURITY MODEL:
 * - Platform Admins see all tenants (for platform management)
 * - Regular users see only their own tenant (via RLS)
 * 
 * Note: Platform Admins can see tenant metadata but need explicit
 * membership to access tenant users (see getAllUsers)
 */
export async function getAllTenants(): Promise<Tenant[]> {
  // Check permission
  await requirePermission("tenants.read");
  
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      throw new Error("Not authenticated");
    }
    
    // Check if current user is Platform Admin
    const isAdmin = await isPlatformAdmin();
    
    if (isAdmin) {
      // Platform Admin: Use admin client to see all tenants
      console.log("[getAllTenants] Platform Admin detected - fetching all tenants");
      const adminClient = createAdminClient();
      
      const result: { data: Tenant[] | null; error: any } = await adminClient
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      
      const data = result.data;
      if (result.error) {
        console.error("[getAllTenants] Error fetching all tenants:", {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
        });
        throw result.error;
      }
      
      // Get user counts and workspace counts per tenant
      const tenantIds = (data || []).map(t => t.id);
      let userCounts: Record<string, number> = {};
      let workspaceCounts: Record<string, number> = {};
      
      if (tenantIds.length > 0) {
        // Get user counts
        const usersResult: { data: { tenant_id: string }[] | null; error: any } = await adminClient
          .from("users")
          .select("tenant_id")
          .in("tenant_id", tenantIds);
        
        const users = usersResult.data;
        userCounts = (users || []).reduce((acc: Record<string, number>, user) => {
          if (user.tenant_id) {
            acc[user.tenant_id] = (acc[user.tenant_id] || 0) + 1;
          }
          return acc;
        }, {});

        // Get workspace counts
        const workspacesResult: { data: { tenant_id: string }[] | null; error: any } = await adminClient
          .from("workspaces")
          .select("tenant_id")
          .in("tenant_id", tenantIds);
        
        const workspaces = workspacesResult.data;
        workspaceCounts = (workspaces || []).reduce((acc: Record<string, number>, workspace) => {
          if (workspace.tenant_id) {
            acc[workspace.tenant_id] = (acc[workspace.tenant_id] || 0) + 1;
          }
          return acc;
        }, {});
      }
      
      const tenantsWithCounts = (data || []).map(tenant => ({
        ...tenant,
        userCount: userCounts[tenant.id] || 0,
        workspaceCount: workspaceCounts[tenant.id] || 0,
      }));
      
      console.log(`[getAllTenants] Fetched ${tenantsWithCounts.length} tenants (Platform Admin view)`);
      return tenantsWithCounts as Tenant[];
    } else {
      // Regular user: Use regular client (RLS will filter to their tenant)
      console.log("[getAllTenants] Regular user - fetching tenant-scoped tenants");
      const result: { data: Tenant[] | null; error: any } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      
      const data = result.data;
      if (result.error) {
        console.error("[getAllTenants] Error fetching tenant:", {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
        });
        throw result.error;
      }
      
      // Get user count and workspace count for this tenant
      let userCount = 0;
      let workspaceCount = 0;
      if (data && data.length > 0) {
        const tenantId = data[0].id;
        const usersResult: { data: { id: string }[] | null; error: any } = await supabase
          .from("users")
          .select("id")
          .eq("tenant_id", tenantId);
        
        userCount = usersResult.data?.length || 0;

        const workspacesResult: { data: { id: string }[] | null; error: any } = await supabase
          .from("workspaces")
          .select("id")
          .eq("tenant_id", tenantId);
        
        workspaceCount = workspacesResult.data?.length || 0;
      }
      
      const tenantsWithCounts = (data || []).map(tenant => ({
        ...tenant,
        userCount,
        workspaceCount,
      }));
      
      console.log(`[getAllTenants] Fetched ${tenantsWithCounts.length} tenant(s) (tenant-scoped)`);
      return tenantsWithCounts as Tenant[];
    }
  } catch (error) {
    console.error("[getAllTenants] Unexpected error:", error);
    
    // Better error serialization for client
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Failed to fetch tenants");
  }
}

export interface CreateTenantData {
  name: string;
  domain: string;
  plan?: string;
  region?: string;
  status?: "active" | "pending" | "suspended";
}

/**
 * Create a new tenant
 * Only Platform Admins can create tenants
 */
export async function createTenant(data: CreateTenantData): Promise<Tenant> {
  // Get current user first for debugging
  const supabase = await createClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("You must be logged in to create tenants");
  }

  console.log(`[createTenant] Attempting to create tenant by user: ${authUser.email} (${authUser.id})`);

  // Check if user is Platform Admin first (more reliable check)
  const isAdmin = await isPlatformAdmin();
  console.log(`[createTenant] Platform Admin check result: ${isAdmin}`);

  if (!isAdmin) {
    // Get user details for better error message
    const adminClient = createAdminClient();
    const { data: userData } = await (adminClient.from("users") as any)
      .select("role_id, tenant_id, roles:role_id(name)")
      .eq("id", authUser.id)
      .single();

    const roleName = (userData?.roles as any)?.name;
    const tenantId = userData?.tenant_id;

    console.error(`[createTenant] User is not Platform Admin:`, {
      userId: authUser.id,
      email: authUser.email,
      roleName: roleName || "No role",
      tenantId: tenantId || "NULL",
      expected: "Platform Admin with tenant_id = NULL",
    });

    throw new Error(
      `Only Platform Administrators can create tenants. ` +
      `Your current role: ${roleName || "None"}, Tenant ID: ${tenantId || "NULL"}. ` +
      `Please ensure you are logged in as a Platform Admin user.`
    );
  }

  // Platform Admins bypass permission check (they have all permissions)
  // But we'll still try it for logging purposes
  try {
    await requirePermission("tenants.write");
  } catch (permissionError: any) {
    // If Platform Admin check passed but permission check failed, log it but continue
    console.warn(`[createTenant] Permission check failed but user is Platform Admin, continuing anyway:`, permissionError.message);
  }
  
  try {

    const adminClient = createAdminClient();

    // Check if domain already exists
    const existingTenant = await adminClient
      .from("tenants")
      .select("id")
      .eq("domain", data.domain)
      .maybeSingle();

    if (existingTenant.data) {
      throw new Error(`A tenant with domain "${data.domain}" already exists`);
    }

    if (existingTenant.error) {
      console.error("[createTenant] Error checking existing tenant:", existingTenant.error);
      throw new Error(`Failed to check if tenant exists: ${existingTenant.error.message}`);
    }

    // Create tenant
    const { data: tenant, error } = await (adminClient.from("tenants") as any)
      .insert({
        name: data.name,
        domain: data.domain,
        plan: data.plan || "free",
        region: data.region || "us-east-1",
        status: data.status || "active",
        features: [],
      })
      .select()
      .single();

    if (error) {
      console.error("[createTenant] Database error creating tenant:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      // Provide more specific error messages
      if (error.code === "23505") {
        throw new Error(`A tenant with domain "${data.domain}" already exists`);
      }
      if (error.code === "23503") {
        throw new Error(`Invalid reference: ${error.message}`);
      }
      if (error.code === "23514") {
        throw new Error(`Validation error: ${error.message}`);
      }
      
      throw new Error(`Database error: ${error.message || "Failed to create tenant"}`);
    }

    if (!tenant) {
      throw new Error("Tenant was not created but no error was returned");
    }

    console.log(`[createTenant] Created tenant: ${tenant.id} (${data.domain})`);
    return { ...tenant, userCount: 0 } as Tenant;
  } catch (error) {
    console.error("[createTenant] Unexpected error:", error);
    
    // Re-throw if it's already an Error with a message
    if (error instanceof Error) {
      throw error;
    }
    
    // Handle Supabase errors
    if (error && typeof error === "object" && "message" in error) {
      throw new Error(`Failed to create tenant: ${String(error.message)}`);
    }
    
    throw new Error("Failed to create tenant: Unknown error occurred");
  }
}

