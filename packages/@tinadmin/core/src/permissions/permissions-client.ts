/**
 * Client-side permission functions
 * Uses browser Supabase client
 */

"use client";

import { createClient as createBrowserClient } from "../database/client";
import type { Database } from "../database/types";
import type { Permission, UserPermissions } from "./utils";

/**
 * Get user permissions based on their role (client-side)
 */
export async function getUserPermissionsClient(
  userId: string,
  tenantId?: string | null
): Promise<UserPermissions> {
  const supabase = createBrowserClient();
  
  // First, check platform role (users.role_id)
  const userResult: { data: { role_id: string | null; tenant_id: string | null; roles: { id: string; name: string; permissions: string[] } | null } | null; error: any } = await supabase
    .from("users")
    .select(`
      role_id,
      tenant_id,
      roles:role_id (
        id,
        name,
        permissions
      )
    `)
    .eq("id", userId)
    .single();

  const user = userResult.data;
  if (userResult.error || !user) {
    return {
      role: null,
      permissions: [],
      isPlatformAdmin: false,
    };
  }

  const platformRole = user.roles as { id: string; name: string; permissions: string[] } | null;
  const platformRoleName = platformRole?.name || null;
  const isPlatformAdmin = platformRoleName === "Platform Admin";

  // Platform Admin always has all permissions
  if (isPlatformAdmin) {
    return {
      role: platformRoleName,
      permissions: [
        "users.read",
        "users.write",
        "users.delete",
        "tenants.read",
        "tenants.write",
        "tenants.delete",
        "roles.read",
        "roles.write",
        "roles.delete",
        "billing.read",
        "billing.write",
        "settings.read",
        "settings.write",
        "analytics.read",
        "api.access",
        "audit.read",
      ],
      isPlatformAdmin: true,
    };
  }

  // If tenant context provided, check for tenant-specific role
  if (tenantId) {
    const tenantRoleResult: { data: { role_id: string; roles: { id: string; name: string; permissions: string[] } | null } | null; error: any } = await supabase
      .from("user_tenant_roles")
      .select(`
        role_id,
        roles:role_id (
          id,
          name,
          permissions
        )
      `)
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const tenantRole = tenantRoleResult.data;
    if (tenantRole) {
      const role = tenantRole.roles as { id: string; name: string; permissions: string[] } | null;
      if (role) {
        return mapRoleToPermissions(role.name, role.permissions as string[]);
      }
    }
  }

  // Otherwise, use platform role
  if (platformRole) {
    return mapRoleToPermissions(platformRole.name, platformRole.permissions as string[]);
  }

  return {
    role: null,
    permissions: [],
    isPlatformAdmin: false,
  };
}

/**
 * Map role name and permissions array to UserPermissions
 */
function mapRoleToPermissions(roleName: string, rolePermissions: string[]): UserPermissions {
  const permissions: Permission[] = [];
  const effectiveRoleName = roleName === "Workspace Admin" ? "Organization Admin" : roleName;

  if (effectiveRoleName === "Organization Admin") {
    permissions.push(
      "users.read",
      "users.write",
      "tenants.read",
      "tenants.write",
      "roles.read",
      "roles.write",
      "settings.read",
      "settings.write",
      "analytics.read"
    );
  } else if (effectiveRoleName === "Billing Owner") {
    permissions.push(
      "billing.read",
      "billing.write",
      "analytics.read"
    );
  } else if (effectiveRoleName === "Developer") {
    permissions.push(
      "api.access",
      "settings.read",
      "analytics.read"
    );
  } else if (effectiveRoleName === "Viewer") {
    permissions.push(
      "users.read",
      "tenants.read",
      "roles.read",
      "analytics.read"
    );
  }

  return {
    role: roleName,
    permissions,
    isPlatformAdmin: false,
  };
}

/**
 * Check if user has a specific permission (client-side)
 */
export async function hasPermissionClient(
  userId: string,
  permission: Permission
): Promise<boolean> {
  const userPermissions = await getUserPermissionsClient(userId);
  return userPermissions.permissions.includes(permission) || userPermissions.isPlatformAdmin;
}

/**
 * Check if user has any of the specified permissions (client-side)
 */
export async function hasAnyPermissionClient(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const userPermissions = await getUserPermissionsClient(userId);
  if (userPermissions.isPlatformAdmin) return true;
  
  return permissions.some(permission => 
    userPermissions.permissions.includes(permission)
  );
}

/**
 * Check if user has all of the specified permissions (client-side)
 */
export async function hasAllPermissionsClient(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const userPermissions = await getUserPermissionsClient(userId);
  if (userPermissions.isPlatformAdmin) return true;
  
  return permissions.every(permission => 
    userPermissions.permissions.includes(permission)
  );
}

