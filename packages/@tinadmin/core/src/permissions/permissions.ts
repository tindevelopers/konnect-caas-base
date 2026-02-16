import { createAdminClient } from "../database/admin-client";
import type { Database } from "../database/types";
import { getEffectiveRole } from "../database/user-tenant-roles";

// Re-export types from utils for backwards compatibility
export type { Permission, UserPermissions } from "./utils";
import type { Permission, UserPermissions } from "./utils";

type Role = Database["public"]["Tables"]["roles"]["Row"];

/**
 * Get user permissions based on their role
 * @param userId - User ID
 * @param tenantId - Optional tenant ID to check tenant-specific role
 */
export async function getUserPermissions(
  userId: string,
  tenantId?: string | null
): Promise<UserPermissions> {
  // Use admin client to bypass RLS for permission checks
  // This ensures we can always check a user's role, even if RLS would block it
  const adminClient = createAdminClient();
  
  // First, check platform role (users.role_id)
  const userResult: { data: { role_id: string | null; tenant_id: string | null; roles: { id: string; name: string; permissions: string[] } | null } | null; error: any } = await adminClient
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
  if (userResult.error) {
    console.error(`[getUserPermissions] Error fetching user ${userId}:`, userResult.error);
    return {
      role: null,
      permissions: [],
      isPlatformAdmin: false,
    };
  }

  if (!user) {
    console.warn(`[getUserPermissions] User ${userId} not found in users table`);
    return {
      role: null,
      permissions: [],
      isPlatformAdmin: false,
    };
  }

  const platformRole = user.roles as { id: string; name: string; permissions: string[] } | null;
  const platformRoleName = platformRole?.name || null;
  const isPlatformAdmin = platformRoleName === "Platform Admin";
  
  // Debug logging for Platform Admin detection
  if (isPlatformAdmin) {
    console.log(`[getUserPermissions] User ${userId} detected as Platform Admin (role: ${platformRoleName}, tenant_id: ${user.tenant_id})`);
  }

  // Platform Admin always has all permissions (regardless of tenant role)
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
    const effectiveRole = await getEffectiveRole(userId, tenantId);
    if (effectiveRole && effectiveRole.source === "tenant") {
      // Use tenant role for permissions
      const tenantRoleResult: { data: { name: string; permissions: string[] } | null; error: any } = await adminClient
        .from("roles")
        .select("name, permissions")
        .eq("id", effectiveRole.roleId)
        .single();

      const tenantRoleData = tenantRoleResult.data;
      if (tenantRoleData) {
        return mapRoleToPermissions(tenantRoleData.name, tenantRoleData.permissions as string[]);
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
  // "Workspace Admin" was renamed to "Organization Admin" in migration; treat as alias for permissions
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
      "analytics.read",
      "integrations.read",
      "integrations.write"
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
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  return userPermissions.permissions.includes(permission) || userPermissions.isPlatformAdmin;
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  if (userPermissions.isPlatformAdmin) return true;
  
  return permissions.some(permission => 
    userPermissions.permissions.includes(permission)
  );
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  if (userPermissions.isPlatformAdmin) return true;
  
  return permissions.every(permission => 
    userPermissions.permissions.includes(permission)
  );
}
