"use server";

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";

type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
type TenantInsert = Database["public"]["Tables"]["tenants"]["Insert"];
type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

type UserWithRelations = UserRow & {
  roles: {
    id: string;
    name: string;
    description: string;
    coverage: string;
    permissions: string[];
  } | null;
  tenants: {
    id: string;
    name: string;
    domain: string;
  } | null;
};

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  tenantName: string;
  tenantDomain: string;
  plan?: string;
  region?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user and create their tenant
 * This is a server action that uses the admin client to bypass RLS
 */
export async function signUp(data: SignUpData) {
  const adminClient = createAdminClient();

  try {
    // 1. Check if tenant already exists, if so use it
    let tenant: TenantRow | null = null;
    let isNewTenant = false;
    
    // Use admin client to bypass RLS when checking for existing tenant
    // Admin client with service_role key bypasses all RLS policies
    // Use rpc or raw query if PostgREST is still evaluating RLS
    let existingTenant = null;
    let checkError = null;
    
    try {
      const result = await adminClient
        .from("tenants")
        .select("*")
        .eq("domain", data.tenantDomain)
        .maybeSingle();
      
      existingTenant = result.data;
      checkError = result.error;
    } catch (err: any) {
      checkError = err;
      console.error("Error checking for existing tenant:", err);
    }
    
    // If we get a function error, try to query without RLS by using a different approach
    if (checkError?.code === "42P17") {
      console.warn("Function error detected, trying alternative query method...");
      // Try querying all tenants and filtering in code (admin client should bypass RLS)
      try {
        const result: { data: TenantRow[] | null; error: any } = await adminClient
          .from("tenants")
          .select("*");
        
        const allTenants = result.data;
        const altError = result.error;
        
        if (!altError && allTenants) {
          existingTenant = allTenants.find(t => t.domain === data.tenantDomain) || null;
          checkError = null;
        }
      } catch (altErr) {
        console.error("Alternative query also failed:", altErr);
      }
    } else if (checkError && checkError.code !== "42P17") {
      throw checkError;
    }

    if (existingTenant) {
      // Tenant exists, use it
      tenant = existingTenant;
      console.log("Using existing tenant:", tenant.id);
    } else {
      // Create new tenant
      const tenantData: TenantInsert = {
        name: data.tenantName,
        domain: data.tenantDomain,
        plan: data.plan || "starter",
        region: data.region || "us-east-1",
        status: "pending",
      };

      const result: { data: TenantRow | null; error: any } = await adminClient
        .from("tenants")
        // @ts-expect-error - Supabase type inference issue with Database types
        .insert(tenantData)
        .select()
        .single();
      
      const newTenant = result.data;
      const tenantError = result.error;

      if (tenantError || !newTenant) {
        // Handle unique constraint violation (domain already exists)
        if (tenantError?.code === "23505") {
          // Try to get the existing tenant
          const existingResult: { data: TenantRow | null; error: any } = await adminClient
            .from("tenants")
            .select("*")
            .eq("domain", data.tenantDomain)
            .single();
          
          const existing = existingResult.data;
          if (existing) {
            tenant = existing;
          } else {
            throw new Error(`A tenant with domain "${data.tenantDomain}" already exists. Please choose a different domain.`);
          }
        } else {
          throw tenantError || new Error("Failed to create tenant");
        }
      } else {
        tenant = newTenant;
        isNewTenant = true; // Mark as newly created
      }
    }

    // 2. Sign up user with Supabase Auth using admin client
    const { data: authData, error: authError } = await adminClient.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          tenant_id: tenant.id,
        },
      },
    });

    if (authError || !authData.user) {
      // If auth fails and we created a NEW tenant, clean it up
      // Don't delete existing tenants!
      if (isNewTenant) {
        try {
          await adminClient.from("tenants").delete().eq("id", tenant.id);
        } catch (cleanupError) {
          console.error("Failed to cleanup tenant:", cleanupError);
        }
      }
      
      // Handle unique constraint violation (email already exists)
      if (
        authError?.message?.includes("already registered") || 
        authError?.message?.includes("already exists") ||
        authError?.message?.includes("User already registered") ||
        authError?.status === 422
      ) {
        throw new Error(`An account with email "${data.email}" already exists. Please sign in instead.`);
      }
      
      throw authError || new Error("Failed to create user");
    }

    // 3. Create user record in users table using admin client
    // Get default "Organization Admin" role
    const roleResult: { data: { id: string } | null; error: any } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", "Organization Admin")
      .single();
    
    const defaultRole = roleResult.data;

    // Platform Admins should have tenant_id = NULL
    // Regular users belong to their tenant
    const userData: UserInsert = {
      id: authData.user.id,
      email: data.email,
      full_name: data.fullName,
      tenant_id: tenant.id,  // Regular users belong to tenant
      role_id: defaultRole?.id || null,
      plan: data.plan || "starter",
      status: "active",
    };

    // Note: If creating a Platform Admin during signup, you would set tenant_id = null
    // But signup typically creates Organization Admins, not Platform Admins

    const userResult: { data: UserRow | null; error: any } = await adminClient
      .from("users")
      // @ts-expect-error - Supabase type inference issue with Database types
      .insert(userData)
      .select()
      .single();
    
    const user = userResult.data;
    const userError = userResult.error;

    if (userError || !user) {
      // If user creation fails, clean up ONLY if we created a new tenant
      // Don't delete existing tenants!
      if (isNewTenant) {
        try {
          await adminClient.from("tenants").delete().eq("id", tenant.id);
        } catch (cleanupError) {
          console.error("Failed to cleanup tenant:", cleanupError);
        }
      }
      
      // Always try to clean up auth user if it was created
      if (authData.user) {
        try {
          await adminClient.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          // Ignore delete errors during cleanup
          console.error("Failed to delete auth user during cleanup:", deleteError);
        }
      }
      
      // Handle unique constraint violation (email already exists)
      if (
        userError?.code === "23505" || 
        userError?.message?.includes("duplicate") || 
        userError?.message?.includes("unique") ||
        userError?.message?.includes("already exists")
      ) {
        throw new Error(`An account with email "${data.email}" already exists. Please sign in instead.`);
      }
      
      throw userError || new Error("Failed to create user record");
    }

    return {
      user,
      tenant,
      session: authData.session,
    };
  } catch (error) {
    console.error("Signup error:", error);
    throw error;
  }
}

/**
 * Sign in existing user
 */
export async function signIn(data: SignInData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  console.log("[signIn] Starting sign in for:", data.email);

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error || !authData.user) {
    console.error("[signIn] Auth error:", error);
    throw error || new Error("Failed to sign in");
  }

  console.log("[signIn] Auth successful, user ID:", authData.user.id);

  // Get user with tenant context using admin client
  const userResult: { data: UserWithRelations | null; error: any } = await adminClient
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
        domain
      )
    `)
    .eq("id", authData.user.id)
    .single();
  
  const user = userResult.data;
  const userError = userResult.error;

  if (userError || !user) {
    console.error("[signIn] Error fetching user:", userError);
    throw userError || new Error("Failed to fetch user");
  }

  console.log("[signIn] User fetched successfully:");
  console.log("[signIn]   - User ID:", user.id);
  console.log("[signIn]   - Email:", user.email);
  console.log("[signIn]   - Role ID:", user.role_id);
  console.log("[signIn]   - Role Name:", (user.roles as any)?.name || "None");
  console.log("[signIn]   - Tenant ID:", user.tenant_id);

  // Update last active timestamp
  const updateResult: { error: any } = await adminClient
    .from("users")
    // @ts-expect-error - Supabase type inference issue with Database types
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", authData.user.id);
  
  if (updateResult.error) {
    console.error("[signIn] Error updating last_active_at:", updateResult.error);
  }

  // Verify the role is Platform Admin
  const roleName = (user.roles as any)?.name;
  const tenantId = user.tenant_id;
  if (roleName === "Platform Admin" && tenantId === null) {
    console.log("[signIn] ✅ User has Platform Admin role (system-level)");
  } else {
    console.log(`[signIn] ⚠️  User role is: ${roleName || "None"}, tenant_id: ${tenantId || "NULL"}`);
  }

  // Force session refresh by calling getUser again
  // This ensures the session is properly set in cookies
  await supabase.auth.getUser();

  return {
    user,
    session: authData.session,
  };
}

/**
 * Sign out current user
 */
export async function signOut() {
  const supabase = await createClient();
  
  console.log("[signOut] Signing out user...");
  
  const { error } = await supabase.auth.signOut({
    scope: 'global'  // Sign out from all sessions
  });
  
  if (error) {
    console.error("[signOut] Error signing out:", error);
    throw error;
  }
  
  console.log("[signOut] Successfully signed out");
}

