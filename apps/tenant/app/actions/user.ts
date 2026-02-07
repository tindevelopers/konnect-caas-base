"use server";

import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";

type User = Database["public"]["Tables"]["users"]["Row"] & {
  roles?: { name: string } | null;
};

/**
 * Get current authenticated user
 * Uses admin client to bypass RLS for Platform Admins
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    
    // Get current authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log("[getCurrentUser] Auth error:", {
        message: authError.message,
        code: authError.code,
      });
      return null;
    }
    
    if (!authUser) {
      console.log("[getCurrentUser] No authenticated user");
      return null;
    }

    console.log("[getCurrentUser] Auth user found:", {
      id: authUser.id,
      email: authUser.email,
    });

    // Use admin client to bypass RLS (especially for Platform Admins)
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch (clientError) {
      console.error("[getCurrentUser] Failed to create admin client:", clientError);
      // Fallback: try with regular client (might work for some users)
      const regularClient = await createClient();
      const fallbackResult: { data: User | null; error: any } = await regularClient
        .from("users")
        .select(`
          *,
          roles:role_id (
            name
          )
        `)
        .eq("id", authUser.id)
        .single();
      
      const userData = fallbackResult.data;
      if (fallbackResult.error || !userData) {
        console.error("[getCurrentUser] Fallback query also failed:", fallbackResult.error);
        return null;
      }
      
      return userData as User;
    }
    
    const result: { data: { email: string; full_name: string | null; tenant_id: string | null; roles: { name: string } | null } | null; error: any } = await adminClient
      .from("users")
      .select(`
        *,
        roles:role_id (
          name
        )
      `)
      .eq("id", authUser.id)
      .single();

    const userData = result.data;
    if (result.error) {
      console.error("[getCurrentUser] Error fetching user:", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        userId: authUser.id,
      });
      // Return null instead of throwing to avoid serialization issues
      return null;
    }

    if (!userData) {
      console.error("[getCurrentUser] No user data found for ID:", authUser.id);
      return null;
    }

    console.log("[getCurrentUser] User loaded successfully:", {
      email: userData.email,
      full_name: userData.full_name,
      role: (userData.roles as any)?.name,
      tenant_id: userData.tenant_id,
    });

    return userData as User;
  } catch (error) {
    // Better error handling - log but don't throw to avoid serialization issues
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    
    console.error("[getCurrentUser] Unexpected error:", {
      message: errorMessage,
      error: error,
    });
    
    // Return null instead of throwing
    return null;
  }
}

