/**
 * Permission Server Actions
 * 
 * Server actions for checking and managing permissions
 */

"use server";

import { createClient } from "@/core/database/server";
import { getUserPermissions, hasPermission, type Permission } from "@/core/permissions/permissions";
import { getTenantPermissions, hasTenantPermission, getPermissionSource } from "@/core/permissions/tenant-permissions";
import { getCurrentUserTenantId } from "@/core/multi-tenancy/validation";

/**
 * Get current user's permissions
 */
export async function getCurrentUserPermissions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      role: null,
      permissions: [],
      isPlatformAdmin: false,
    };
  }

  return getUserPermissions(user.id);
}

/**
 * Get current user's tenant permissions
 */
export async function getCurrentUserTenantPermissions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    return null;
  }

  return getTenantPermissions(user.id, tenantId);
}

/**
 * Check if current user has permission
 */
export async function checkCurrentUserPermission(permission: Permission) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  return hasPermission(user.id, permission);
}

/**
 * Check if current user has tenant permission
 */
export async function checkCurrentUserTenantPermission(permission: Permission) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    return false;
  }

  return hasTenantPermission(user.id, tenantId, permission);
}

/**
 * Get permission source for current user
 */
export async function getCurrentUserPermissionSource(permission: Permission) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      hasPermission: false,
      source: "none" as const,
    };
  }

  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    return {
      hasPermission: false,
      source: "none" as const,
    };
  }

  return getPermissionSource(user.id, tenantId, permission);
}


