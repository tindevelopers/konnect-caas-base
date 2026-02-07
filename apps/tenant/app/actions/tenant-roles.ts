"use server";

import { requirePermission } from "@/core/permissions/middleware";
import { assignTenantRole, removeTenantRole, getUserTenantRoles } from "@/core/database/user-tenant-roles";
import type { Database } from "@/core/database";

type UserTenantRole = Database["public"]["Tables"]["user_tenant_roles"]["Row"] & {
  tenants?: { name: string; domain: string } | null;
  roles?: { name: string; description: string } | null;
};

/**
 * Assign a tenant role to a user (Platform Admin only)
 */
export async function assignTenantRoleAction(
  userId: string,
  tenantId: string,
  roleName: string
) {
  await requirePermission("users.write");
  
  try {
    const result = await assignTenantRole(userId, tenantId, roleName);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error assigning tenant role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to assign tenant role",
    };
  }
}

/**
 * Remove a tenant role from a user (Platform Admin only)
 */
export async function removeTenantRoleAction(
  userId: string,
  tenantId: string,
  roleName: string
) {
  await requirePermission("users.write");
  
  try {
    await removeTenantRole(userId, tenantId, roleName);
    return { success: true };
  } catch (error) {
    console.error("Error removing tenant role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove tenant role",
    };
  }
}

/**
 * Get all tenant roles for a user
 */
export async function getUserTenantRolesAction(userId: string): Promise<UserTenantRole[]> {
  await requirePermission("users.read");
  
  try {
    const roles = await getUserTenantRoles(userId);
    return roles as UserTenantRole[];
  } catch (error) {
    console.error("Error fetching user tenant roles:", error);
    return [];
  }
}

