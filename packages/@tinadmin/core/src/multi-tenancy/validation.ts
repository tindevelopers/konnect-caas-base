/**
 * Tenant Validation Utilities
 * 
 * Provides validation functions for tenant operations and access control
 */

import { createClient as createServerClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { isPlatformAdmin } from "@/core/database/organization-admins";
import type { Database } from "@/core/database";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];

export interface TenantValidationResult {
  isValid: boolean;
  error?: string;
  tenant?: Tenant;
}

/**
 * Validate that a tenant ID exists and is accessible by the current user
 */
export async function validateTenantAccess(
  tenantId: string | null | undefined,
  options?: { requireTenant?: boolean }
): Promise<TenantValidationResult> {
  if (!tenantId) {
    if (options?.requireTenant) {
      return {
        isValid: false,
        error: "Tenant ID is required",
      };
    }
    // Platform Admins can have null tenant_id
    return { isValid: true };
  }

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        isValid: false,
        error: "User not authenticated",
      };
    }

    // Check if user is Platform Admin
    const adminStatus = await isPlatformAdmin();

    if (adminStatus) {
      // Platform Admin: Use admin client to check tenant exists
      const adminClient = createAdminClient();
      const { data: tenant, error } = await adminClient
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .single();

      if (error || !tenant) {
        return {
          isValid: false,
          error: "Tenant not found",
        };
      }

      return {
        isValid: true,
        tenant,
      };
    } else {
      // Regular user: Check if tenant matches their tenant_id
      const userDataResult: { data: { tenant_id: string | null } | null; error: any } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const userData = userDataResult.data;
      if (!userData || userData.tenant_id !== tenantId) {
        return {
          isValid: false,
          error: "Access denied: Tenant does not match user's tenant",
        };
      }

      // Get tenant details
      const tenantResult: { data: any | null; error: any } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .single();
      
      const tenant = tenantResult.data;
      const error = tenantResult.error;

      if (error || !tenant) {
        return {
          isValid: false,
          error: "Tenant not found",
        };
      }

      return {
        isValid: true,
        tenant,
      };
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

/**
 * Validate tenant domain format
 */
export function validateTenantDomain(domain: string): { isValid: boolean; error?: string } {
  if (!domain || domain.trim().length === 0) {
    return {
      isValid: false,
      error: "Domain is required",
    };
  }

  // Basic domain validation (alphanumeric, hyphens, dots)
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

  if (!domainRegex.test(domain)) {
    return {
      isValid: false,
      error: "Invalid domain format. Use alphanumeric characters, hyphens, and dots only",
    };
  }

  if (domain.length > 255) {
    return {
      isValid: false,
      error: "Domain must be 255 characters or less",
    };
  }

  return { isValid: true };
}

/**
 * Check if current user has access to a specific tenant
 */
export async function hasTenantAccess(tenantId: string): Promise<boolean> {
  const result = await validateTenantAccess(tenantId);
  return result.isValid;
}

/**
 * Get current user's tenant ID
 */
export async function getCurrentUserTenantId(): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const userDataResult2: { data: { tenant_id: string | null } | null; error: any } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const userData = userDataResult2.data;
    return userData?.tenant_id || null;
  } catch {
    return null;
  }
}

/**
 * Ensure tenant_id is set for tenant-scoped operations
 */
export async function ensureTenantId(
  providedTenantId?: string | null
): Promise<string> {
  if (providedTenantId) {
    const validation = await validateTenantAccess(providedTenantId, { requireTenant: true });
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid tenant ID");
    }
    return providedTenantId;
  }

  // Try request-scoped context (middleware/header/cookie) before falling back to session user.
  // This supports Platform Admin "selected tenant" flows and tenant-aware public portals.
  try {
    const { headers, cookies } = await import("next/headers");
    const h = await headers();
    const c = await cookies();
    const fromHeader = h.get("x-tenant-id");
    const fromCookie = c.get("current_tenant_id")?.value;
    const contextualTenantId = fromHeader || fromCookie || null;

    if (contextualTenantId) {
      const validation = await validateTenantAccess(contextualTenantId, { requireTenant: true });
      if (validation.isValid) {
        return contextualTenantId;
      }
    }
  } catch {
    // Not in a request scope (or next/headers not available) — ignore.
  }

  // Get from current user
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant ID is required but not found in user context");
  }

  return tenantId;
}

