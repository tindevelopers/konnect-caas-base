/**
 * Tenant-Level Permissions
 * 
 * Implements tenant-scoped permissions and permission inheritance
 */

import { createClient as createServerClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import type { Database } from "@/core/database";
import { getUserPermissions, type Permission } from "./permissions";

type TenantPermission = Database["public"]["Tables"]["tenants"]["Row"] & {
  custom_permissions?: Permission[];
};

export interface TenantPermissionConfig {
  tenantId: string;
  permissions: Permission[];
  inheritedFrom?: string; // Role name or parent tenant
}

/**
 * Get tenant-specific permissions for a user
 * Combines role permissions with tenant-specific overrides
 */
export async function getTenantPermissions(
  userId: string,
  tenantId: string
): Promise<TenantPermissionConfig> {
  const supabase = await createServerClient();
  
  // Get user's role permissions (pass tenantId so tenant-specific roles are considered)
  const rolePermissions = await getUserPermissions(userId, tenantId);
  
  // Get tenant-specific permission overrides
  const tenantResult: { data: { features: any } | null; error: any } = await supabase
    .from("tenants")
    .select("features")
    .eq("id", tenantId)
    .single();

  const tenant = tenantResult.data;
  // Start with role permissions
  let permissions: Permission[] = [...rolePermissions.permissions];

  // Apply tenant-specific permission overrides from features
  // Features array can contain permission strings
  if (tenant?.features && Array.isArray(tenant.features)) {
    const tenantFeaturePermissions = tenant.features.filter((f: any): f is Permission =>
      typeof f === "string" && f.includes(".")
    ) as Permission[];
    
    // Add tenant-specific permissions
    permissions = [...new Set([...permissions, ...tenantFeaturePermissions])];
  }

  return {
    tenantId,
    permissions,
    inheritedFrom: rolePermissions.role || undefined,
  };
}

/**
 * Check if user has permission in a specific tenant context
 */
export async function hasTenantPermission(
  userId: string,
  tenantId: string,
  permission: Permission
): Promise<boolean> {
  const tenantPermissions = await getTenantPermissions(userId, tenantId);
  return tenantPermissions.permissions.includes(permission);
}

/**
 * Get workspace-level permissions (for future workspace feature)
 */
export async function getWorkspacePermissions(
  userId: string,
  tenantId: string,
  workspaceId?: string
): Promise<TenantPermissionConfig> {
  // For now, workspace permissions inherit from tenant
  // In the future, this can be extended to support workspace-specific permissions
  const tenantPermissions = await getTenantPermissions(userId, tenantId);
  
  if (workspaceId) {
    // Future: Add workspace-specific permission overrides
    // For now, return tenant permissions
  }

  return tenantPermissions;
}

/**
 * Check permission inheritance chain
 * Returns the source of permission (role, tenant override, workspace override)
 */
export async function getPermissionSource(
  userId: string,
  tenantId: string,
  permission: Permission
): Promise<{
  hasPermission: boolean;
  source: "role" | "tenant" | "workspace" | "none";
  inheritedFrom?: string;
}> {
  const rolePermissions = await getUserPermissions(userId);
  
  // Check if permission comes from role
  if (rolePermissions.permissions.includes(permission)) {
    return {
      hasPermission: true,
      source: "role",
      inheritedFrom: rolePermissions.role || undefined,
    };
  }

  // Check tenant-specific permissions
  const tenantPermissions = await getTenantPermissions(userId, tenantId);
  if (tenantPermissions.permissions.includes(permission)) {
    return {
      hasPermission: true,
      source: "tenant",
      inheritedFrom: tenantId,
    };
  }

  return {
    hasPermission: false,
    source: "none",
  };
}

/**
 * Apply permission inheritance
 * Child tenants inherit permissions from parent tenants
 */
export async function applyPermissionInheritance(
  tenantId: string
): Promise<Permission[]> {
  const adminClient = createAdminClient();
  
  // Get tenant
  const tenantResult2: { data: { id: string; features: any } | null; error: any } = await adminClient
    .from("tenants")
    .select("id, features")
    .eq("id", tenantId)
    .single();

  const tenant = tenantResult2.data;
  if (!tenant) {
    return [];
  }

  // For now, return tenant features as permissions
  // In the future, this can check for parent_tenant_id and inherit
  const permissions = (tenant.features || []).filter(
    (f: any): f is Permission => typeof f === "string" && f.includes(".")
  ) as Permission[];

  return permissions;
}

