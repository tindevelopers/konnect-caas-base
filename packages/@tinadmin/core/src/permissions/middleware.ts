/**
 * Permission Middleware
 * 
 * Server-side middleware for checking permissions in API routes and server actions
 */

import { createClient } from "@/core/database/server";
import { getUserPermissions, hasPermission, hasAnyPermission, hasAllPermissions, type Permission } from "./permissions";
import { hasTenantPermission } from "./tenant-permissions";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { logPermissionCheckWithContext } from "@/core/auth/audit-log";

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check permission in server action/API route
 */
export async function checkPermission(
  permission: Permission,
  options?: { tenantId?: string }
): Promise<PermissionCheckResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        allowed: false,
        reason: "User not authenticated",
      };
    }

    // If tenant context is required, check tenant permission
    if (options?.tenantId) {
      const hasAccess = await hasTenantPermission(user.id, options.tenantId, permission);
      return {
        allowed: hasAccess,
        reason: hasAccess ? undefined : "Insufficient tenant permissions",
      };
    }

    // Otherwise, check role permission
    // Get user permissions to check Platform Admin status
    const userPermissions = await getUserPermissions(user.id);
    
    // Debug logging
    if (!userPermissions.isPlatformAdmin && !userPermissions.permissions.includes(permission)) {
      console.log(`[Permission Check] User ${user.id} (${user.email}) - Role: ${userPermissions.role}, IsPlatformAdmin: ${userPermissions.isPlatformAdmin}, Permissions: ${userPermissions.permissions.join(", ")}, Required: ${permission}`);
    }
    
    // Platform Admins have all permissions
    const hasAccess = userPermissions.isPlatformAdmin || userPermissions.permissions.includes(permission);
    
    // Log permission check
    let tenantId = options?.tenantId ?? null;
    if (!tenantId) {
      try {
        tenantId = await ensureTenantId();
      } catch {
        tenantId = null;
      }
    }
    await logPermissionCheckWithContext(user.id, permission, hasAccess, {
      tenantId,
      action: "permission_check",
      resource: "api",
      reason: hasAccess ? undefined : "Insufficient permissions",
    });
    
    return {
      allowed: hasAccess,
      reason: hasAccess ? undefined : "Insufficient permissions",
    };
  } catch (error) {
    console.error("Permission check error:", error);
    return {
      allowed: false,
      reason: error instanceof Error ? error.message : "Permission check failed",
    };
  }
}

/**
 * Check if user has any of the specified permissions
 */
export async function checkAnyPermission(
  permissions: Permission[],
  options?: { tenantId?: string }
): Promise<PermissionCheckResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        allowed: false,
        reason: "User not authenticated",
      };
    }

    if (options?.tenantId) {
      // Check tenant permissions for each permission
      const checks = await Promise.all(
        permissions.map(p => hasTenantPermission(user.id, options.tenantId!, p))
      );
      const hasAccess = checks.some(check => check);
      
      return {
        allowed: hasAccess,
        reason: hasAccess ? undefined : "Insufficient tenant permissions",
      };
    }

    const hasAccess = await hasAnyPermission(user.id, permissions);
    return {
      allowed: hasAccess,
      reason: hasAccess ? undefined : "Insufficient permissions",
    };
  } catch (error) {
    console.error("Permission check error:", error);
    return {
      allowed: false,
      reason: error instanceof Error ? error.message : "Permission check failed",
    };
  }
}

/**
 * Check if user has all of the specified permissions
 */
export async function checkAllPermissions(
  permissions: Permission[],
  options?: { tenantId?: string }
): Promise<PermissionCheckResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        allowed: false,
        reason: "User not authenticated",
      };
    }

    if (options?.tenantId) {
      const checks = await Promise.all(
        permissions.map(p => hasTenantPermission(user.id, options.tenantId!, p))
      );
      const hasAccess = checks.every(check => check);
      
      return {
        allowed: hasAccess,
        reason: hasAccess ? undefined : "Missing required tenant permissions",
      };
    }

    const hasAccess = await hasAllPermissions(user.id, permissions);
    return {
      allowed: hasAccess,
      reason: hasAccess ? undefined : "Missing required permissions",
    };
  } catch (error) {
    console.error("Permission check error:", error);
    return {
      allowed: false,
      reason: error instanceof Error ? error.message : "Permission check failed",
    };
  }
}

/**
 * Require permission - throws error if permission is not granted
 */
export async function requirePermission(
  permission: Permission,
  options?: { tenantId?: string }
): Promise<void> {
  const result = await checkPermission(permission, options);
  if (!result.allowed) {
    throw new Error(result.reason || "Permission denied");
  }
}

/**
 * Require any permission - throws error if none of the permissions are granted
 */
export async function requireAnyPermission(
  permissions: Permission[],
  options?: { tenantId?: string }
): Promise<void> {
  const result = await checkAnyPermission(permissions, options);
  if (!result.allowed) {
    throw new Error(result.reason || "Permission denied");
  }
}

/**
 * Require all permissions - throws error if any permission is missing
 */
export async function requireAllPermissions(
  permissions: Permission[],
  options?: { tenantId?: string }
): Promise<void> {
  const result = await checkAllPermissions(permissions, options);
  if (!result.allowed) {
    throw new Error(result.reason || "Permission denied");
  }
}

