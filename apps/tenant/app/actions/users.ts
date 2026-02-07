"use server";

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";
import { isPlatformAdmin } from "./organization-admins";
import { requirePermission } from "@/core/permissions/middleware";

type User = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { 
    id: string;
    name: string;
    description: string;
    coverage: string;
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
 * Get all users that the current user has access to
 * 
 * BEST PRACTICE SECURITY MODEL:
 * - Platform Admins see:
 *   1. All Platform Admins (system-level users with tenant_id = NULL)
 *   2. Users from tenants they're explicitly added to (as Tenant Admin/Org Admin)
 * - Regular users see only users in their tenant (via RLS)
 * 
 * This maintains proper tenant isolation and privacy compliance.
 */
export async function getAllUsers(): Promise<User[]> {
  // Check permission
  await requirePermission("users.read");
  
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      throw new Error("Not authenticated");
    }
    
    // Check if current user is Platform Admin
    const isAdmin = await isPlatformAdmin();
    
    if (isAdmin) {
      // Platform Admin: See ALL users (Platform Admins + all tenant users)
      console.log("[getAllUsers] Platform Admin detected - fetching all users");
      const adminClient = createAdminClient();
      
      // Platform Admins should see all users in the system
      const { data: allUsersData, error: usersError } = await adminClient
        .from("users")
        .select(`
          *,
          roles:role_id (
            id,
            name,
            description,
            coverage,
            permissions
          ),
          tenants:tenant_id (
            id,
            name,
            domain,
            status
          )
        `)
        .order("created_at", { ascending: false });
      
      if (usersError) {
        console.error("[getAllUsers] Error fetching all users:", usersError);
        throw usersError;
      }
      
      const allUsers = (allUsersData || []) as User[];
      
      console.log(`[getAllUsers] Fetched ${allUsers.length} total users (Platform Admin view)`);
      console.log(`  - Platform Admins: ${allUsers.filter(u => u.tenant_id === null).length}`);
      console.log(`  - Tenant users: ${allUsers.filter(u => u.tenant_id !== null).length}`);
      
      return allUsers;
    } else {
      // Regular user: Use regular client (RLS will filter by tenant)
      console.log("[getAllUsers] Regular user - fetching tenant-scoped users");
      const { data, error } = await supabase
        .from("users")
        .select(`
          *,
          roles:role_id (
            id,
            name,
            description,
            coverage,
            permissions
          ),
          tenants:tenant_id (
            id,
            name,
            domain,
            status
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("[getAllUsers] Error fetching tenant users:", error);
        throw error;
      }
      
      console.log(`[getAllUsers] Fetched ${data?.length || 0} users (tenant-scoped)`);
      return (data || []) as User[];
    }
  } catch (error) {
    console.error("[getAllUsers] Unexpected error:", error);
    throw error;
  }
}

export interface CreateUserData {
  email: string;
  full_name: string;
  password: string;
  role_id?: string | null;
  tenant_id?: string | null;
  plan?: string;
  status?: string;
}

/**
 * Create a new user
 */
export async function createUser(data: CreateUserData): Promise<{ success: boolean; user?: User; error?: string }> {
  await requirePermission("users.write");
  
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    // Validate email
    if (!data.email || !data.email.includes("@")) {
      throw new Error("Valid email is required");
    }

    // Validate password
    if (!data.password || data.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Create user in Supabase Auth
    console.log("[createUser] Creating auth user:", { email: data.email });
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError || !authData.user) {
      console.error("[createUser] Auth error:", authError);
      if (authError?.message?.includes("already registered") || authError?.message?.includes("already exists")) {
        throw new Error(`User with email "${data.email}" already exists`);
      }
      const errorMsg = authError instanceof Error ? authError.message : (authError as any)?.message || "Unknown error";
      throw authError || new Error(`Failed to create user in Auth: ${errorMsg}`);
    }
    
    console.log("[createUser] Auth user created successfully:", authData.user.id);

    // Get default role if not provided
    let roleId = data.role_id;
    if (!roleId) {
      console.log("[createUser] Looking up default role: Workspace Admin");
      // Try "Workspace Admin" first (from migration), fallback to "Organization Admin"
      let roleResult: { data: { id: string } | null; error: any } = await adminClient
        .from("roles")
        .select("id")
        .eq("name", "Workspace Admin")
        .single();
      
      if (roleResult.error || !roleResult.data) {
        console.log("[createUser] Workspace Admin not found, trying Organization Admin");
        roleResult = await adminClient
          .from("roles")
          .select("id")
          .eq("name", "Organization Admin")
          .single();
      }
      
      if (roleResult.error) {
        console.error("[createUser] Error fetching role:", roleResult.error);
        // List available roles for debugging
        const allRoles = await adminClient.from("roles").select("id, name");
        console.error("[createUser] Available roles:", allRoles.data);
        throw new Error(`Failed to fetch role: ${roleResult.error.message}. Available roles: ${JSON.stringify(allRoles.data)}`);
      }
      
      roleId = roleResult.data?.id || null;
      console.log("[createUser] Role ID:", roleId);
    } else {
      console.log("[createUser] Using provided role_id:", roleId);
    }

    // Create user record in users table
    const userData: any = {
      id: authData.user.id,
      email: data.email,
      full_name: data.full_name,
      tenant_id: data.tenant_id || null,
      role_id: roleId,
      plan: data.plan || "starter",
      status: data.status || "active",
    };

    console.log("[createUser] Inserting user record:", { ...userData, password: "[REDACTED]" });
    const { data: user, error: userError } = await (adminClient.from("users") as any)
      .insert(userData)
      .select(`
        *,
        roles:role_id (
          id,
          name,
          description,
          coverage,
          permissions
        ),
        tenants:tenant_id (
          id,
          name,
          domain,
          status
        )
      `)
      .single();

    if (userError || !user) {
      console.error("[createUser] Error inserting user record:", userError);
      // Cleanup auth user if user creation fails
      try {
        console.log("[createUser] Cleaning up auth user:", authData.user.id);
        await adminClient.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error("[createUser] Failed to cleanup auth user:", cleanupError);
      }
      
      // Provide more detailed error message
      if (userError?.code === "23505") {
        throw new Error(`User with email "${data.email}" already exists in the database`);
      } else if (userError?.code === "23503") {
        throw new Error(`Invalid reference: ${userError.message}. Please check role_id and tenant_id.`);
      } else if (userError?.message) {
        throw new Error(`Database error: ${userError.message}`);
      }
      throw userError || new Error("Failed to create user record");
    }
    
    console.log("[createUser] User created successfully:", user.id);

    return { success: true, user: user as User };
  } catch (error) {
    console.error("[createUser] Unexpected error:", error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : "Failed to create user";
    
    console.error("[createUser] Error details:", {
      message: errorMessage,
      error: error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export interface UpdateUserData {
  full_name?: string;
  role_id?: string | null;
  tenant_id?: string | null;
  plan?: string;
  status?: string;
}

/**
 * Update an existing user
 */
export async function updateUser(userId: string, data: UpdateUserData): Promise<{ success: boolean; user?: User; error?: string }> {
  await requirePermission("users.write");
  
  try {
    const adminClient = createAdminClient();

    const updateData: any = {};
    if (data.full_name !== undefined) updateData.full_name = data.full_name;
    if (data.role_id !== undefined) updateData.role_id = data.role_id;
    if (data.tenant_id !== undefined) updateData.tenant_id = data.tenant_id;
    if (data.plan !== undefined) updateData.plan = data.plan;
    if (data.status !== undefined) updateData.status = data.status;

    const { data: user, error } = await (adminClient.from("users") as any)
      .update(updateData)
      .eq("id", userId)
      .select(`
        *,
        roles:role_id (
          id,
          name,
          description,
          coverage,
          permissions
        ),
        tenants:tenant_id (
          id,
          name,
          domain,
          status
        )
      `)
      .single();

    if (error || !user) {
      throw error || new Error("Failed to update user");
    }

    return { success: true, user: user as User };
  } catch (error) {
    console.error("[updateUser] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user",
    };
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  await requirePermission("users.write");
  
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    // Prevent self-deletion
    if (currentUser.id === userId) {
      throw new Error("You cannot delete your own account");
    }

    // Delete from users table first
    const { error: deleteError } = await adminClient
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      throw deleteError;
    }

    // Delete from Auth
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("[deleteUser] Error deleting auth user:", authError);
      // Don't throw - user record is already deleted
    }

    return { success: true };
  } catch (error) {
    console.error("[deleteUser] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
  }
}

/**
 * Get all roles for dropdown
 */
export async function getAllRoles(): Promise<Array<{ id: string; name: string }>> {
  await requirePermission("users.read");
  
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("roles")
      .select("id, name")
      .order("name");

    if (error) {
      throw error;
    }

    return (data || []) as Array<{ id: string; name: string }>;
  } catch (error) {
    console.error("[getAllRoles] Error:", error);
    return [];
  }
}

/**
 * Get all tenants for dropdown
 */
export async function getAllTenantsForUser(): Promise<Array<{ id: string; name: string; domain: string }>> {
  await requirePermission("users.read");
  
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("tenants")
      .select("id, name, domain")
      .eq("status", "active")
      .order("name");

    if (error) {
      throw error;
    }

    return (data || []) as Array<{ id: string; name: string; domain: string }>;
  } catch (error) {
    console.error("[getAllTenantsForUser] Error:", error);
    return [];
  }
}

