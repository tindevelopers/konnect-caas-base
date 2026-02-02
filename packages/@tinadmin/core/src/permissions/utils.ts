/**
 * Permission Utilities
 * 
 * Pure utility functions that don't require server-only dependencies
 * These can be used in tests and client-side code
 */

/**
 * Permission type - all available permissions
 */
export type Permission = 
  | "users.read"
  | "users.write"
  | "users.delete"
  | "tenants.read"
  | "tenants.write"
  | "tenants.delete"
  | "roles.read"
  | "roles.write"
  | "roles.delete"
  | "billing.read"
  | "billing.write"
  | "settings.read"
  | "settings.write"
  | "analytics.read"
  | "api.access"
  | "audit.read"
  | "integrations.read"
  | "integrations.write";

/**
 * User permissions result
 */
export interface UserPermissions {
  role: string | null;
  permissions: Permission[];
  isPlatformAdmin: boolean;
}

/**
 * All available permissions in the system
 */
export const PERMISSIONS = {
  // USER MANAGEMENT
  'users.read': 'View users',
  'users.write': 'Create and edit users',
  'users.delete': 'Delete users',
  
  // TENANT MANAGEMENT
  'tenants.read': 'View tenants',
  'tenants.write': 'Create and edit tenants',
  'tenants.delete': 'Delete tenants',
  
  // ROLE MANAGEMENT
  'roles.read': 'View roles',
  'roles.write': 'Create and edit roles',
  'roles.delete': 'Delete roles',
  
  // BILLING
  'billing.read': 'View billing information',
  'billing.write': 'Manage billing and subscriptions',
  
  // ANALYTICS
  'analytics.read': 'View analytics',
  'analytics.export': 'Export analytics data',
  
  // SETTINGS
  'settings.read': 'View settings',
  'settings.write': 'Update settings',
  
  // WHITE LABEL
  'whitelabel.read': 'View white-label settings',
  'whitelabel.write': 'Update white-label settings',
  
  // INTEGRATIONS
  'integrations.read': 'View integrations',
  'integrations.write': 'Manage integrations',
  
  // WEBHOOKS
  'webhooks.read': 'View webhooks',
  'webhooks.write': 'Manage webhooks',
  
  // AUDIT LOGS
  'audit.read': 'View audit logs',
  
  // SUPPORT
  'support.read': 'View support tickets',
  'support.write': 'Manage support tickets',
} as const;

/**
 * Permission categories for organization
 */
export const PERMISSION_CATEGORIES = {
  ADMIN: ['users.*', 'tenants.*', 'roles.*'],
  BILLING: ['billing.*'],
  ANALYTICS: ['analytics.*'],
  SETTINGS: ['settings.*', 'whitelabel.*'],
  INTEGRATIONS: ['integrations.*', 'webhooks.*'],
  SUPPORT: ['support.*'],
} as const;

/**
 * Role-based permission presets
 */
export const ROLE_PERMISSIONS = {
  'Platform Admin': Object.keys(PERMISSIONS), // All permissions
  'Organization Admin': [
    'users.read', 'users.write',
    'tenants.read',
    'roles.read',
    'billing.read', 'billing.write',
    'analytics.read', 'analytics.export',
    'settings.read', 'settings.write',
    'whitelabel.read', 'whitelabel.write',
    'integrations.read', 'integrations.write',
    'support.read', 'support.write',
  ],
  'User': [
    'users.read',
    'billing.read',
    'analytics.read',
    'settings.read',
    'support.read', 'support.write',
  ],
  'Guest': [
    'settings.read',
  ],
} as const;

/**
 * Check if a permission string matches a pattern
 * Supports wildcards: 'users.*' matches 'users.read', 'users.write', etc.
 */
export function matchesPermission(permission: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === permission) return true;
  
  const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
  return regex.test(permission);
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(roleName: string): string[] {
  const perms = ROLE_PERMISSIONS[roleName as keyof typeof ROLE_PERMISSIONS];
  return perms ? [...perms] : [];
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(roleName: string, permission: string): boolean {
  const rolePerms = getPermissionsForRole(roleName);
  return rolePerms.some(p => matchesPermission(permission, p));
}

/**
 * Get permission category for a permission
 */
export function getPermissionCategory(permission: string): string | null {
  for (const [category, patterns] of Object.entries(PERMISSION_CATEGORIES)) {
    if (patterns.some(pattern => matchesPermission(permission, pattern))) {
      return category;
    }
  }
  return null;
}

/**
 * Get all permissions in a category
 */
export function getPermissionsInCategory(category: keyof typeof PERMISSION_CATEGORIES): string[] {
  const patterns = PERMISSION_CATEGORIES[category];
  return Object.keys(PERMISSIONS).filter(permission =>
    patterns.some(pattern => matchesPermission(permission, pattern))
  );
}
