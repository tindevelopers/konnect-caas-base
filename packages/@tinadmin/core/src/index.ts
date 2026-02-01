/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SAAS CORE - MAIN ENTRY POINT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This is the central module for the entire SaaS platform.
 * All core functionality is organized by domain and exported from here.
 * 
 * USAGE:
 * Import from '@/core' or '@/core/{domain}' throughout your application.
 * 
 * RULES:
 * 1. ONLY import from this file or domain index files (e.g., '@/core/auth')
 * 2. NEVER import internal files directly (e.g., '@/core/auth/supabase-provider')
 * 3. Keep domains loosely coupled - minimize cross-domain dependencies
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ============================================================================
// 🔐 AUTH DOMAIN
// ============================================================================
/**
 * Authentication, sessions, password management, and audit logging.
 * 
 * @example
 * ```typescript
 * import { signIn, getCurrentUser, requirePermission } from '@/core';
 * 
 * // Or import from domain:
 * import { signIn } from '@/core/auth';
 * ```
 */
export * from './auth';

// ============================================================================
// 🏢 MULTI-TENANCY DOMAIN
// ============================================================================
/**
 * Tenant management, isolation, white-labeling, and subdomain routing.
 * 
 * @example
 * ```typescript
 * import { 
 *   getCurrentTenant, 
 *   createTenantQuery,
 *   getBrandingSettings 
 * } from '@/core';
 * 
 * // Or import from domain:
 * import { getCurrentTenant } from '@/core/multi-tenancy';
 * ```
 */
export * from './multi-tenancy';

// ============================================================================
// 💳 BILLING DOMAIN
// ============================================================================
/**
 * Stripe integration, subscriptions, payments, invoicing, and webhooks.
 * 
 * @example
 * ```typescript
 * import { 
 *   createCheckoutSession,
 *   getActiveSubscription,
 *   formatCurrency 
 * } from '@/core';
 * 
 * // Or import from domain:
 * import { createCheckoutSession } from '@/core/billing';
 * ```
 */
export * from './billing';

// ============================================================================
// 🔒 PERMISSIONS DOMAIN
// ============================================================================
/**
 * Role-Based Access Control (RBAC), permission checking, and access gates.
 * 
 * @example
 * ```typescript
 * import { 
 *   hasPermission,
 *   requirePermission,
 *   PermissionGate,
 *   PERMISSIONS 
 * } from '@/core';
 * 
 * // Or import from domain:
 * import { hasPermission } from '@/core/permissions';
 * ```
 */
export * from './permissions';

// ============================================================================
// 🔌 INTEGRATIONS DOMAIN
// ============================================================================
/**
 * Integration configs (CRM, etc.) per tenant.
 */
export * from './integrations';

// ============================================================================
// 🗄️ DATABASE DOMAIN
// ============================================================================
/**
 * Database clients, types, and data access layer.
 * 
 * @example
 * ```typescript
 * import { 
 *   createClient,
 *   createAdminClient,
 *   getUser,
 *   getTenant 
 * } from '@/core';
 * 
 * // Or import from domain:
 * import { createClient } from '@/core/database';
 * ```
 */
export * from './database';

// ============================================================================
// 🔧 SHARED DOMAIN
// ============================================================================
/**
 * Common utilities, types, constants, and helpers.
 * 
 * @example
 * ```typescript
 * import { 
 *   sleep,
 *   retry,
 *   isValidEmail,
 *   APP_CONFIG,
 *   FEATURES 
 * } from '@/core';
 * 
 * // Or import from domain:
 * import { sleep } from '@/core/shared';
 * ```
 */
export * from './shared';

// ============================================================================
// 🤖 CHATBOT DOMAIN
// ============================================================================
/**
 * Multi-tenant RAG chatbot with domain intelligence.
 * 
 * @example
 * ```typescript
 * import { 
 *   processChatMessage,
 *   createKnowledgeBase,
 *   detectDomain
 * } from '@/core';
 * 
 * // Or import from domain:
 * import { processChatMessage } from '@/core/chatbot';
 * ```
 */
export * from './chatbot';

// ============================================================================
// 📋 CORE METADATA
// ============================================================================

/**
 * Core module version
 */
export const CORE_VERSION = '1.0.0';

/**
 * Core module metadata
 */
export const CORE_METADATA = {
  version: CORE_VERSION,
  domains: [
    'auth',
    'multi-tenancy',
    'billing',
    'permissions',
    'database',
    'shared',
    'chatbot',
  ],
  name: '@yourcompany/saas-core',
  description: 'Central SaaS platform core module',
} as const;

/**
 * Get core module info
 */
export function getCoreInfo() {
  return {
    ...CORE_METADATA,
    environment: process.env.NODE_ENV,
    features: {
      auth: true,
      multiTenant: process.env.NEXT_PUBLIC_MULTI_TENANT_ENABLED === 'true',
      billing: !!process.env.STRIPE_SECRET_KEY,
      permissions: true,
      database: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  };
}

// ============================================================================
// 🎯 CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * Most commonly used exports for quick access
 */

// Auth
export { signIn, signUp, signOut, getCurrentUser } from './auth';

// Multi-Tenancy
// Note: getCurrentTenant is server-only and should be imported directly:
//   import { getCurrentTenant } from '@/core/multi-tenancy/server';
export { useTenant, TenantProvider } from './multi-tenancy';

// Billing
// Note: Billing functions are server-only and should be imported directly:
//   import { createCheckoutSession, getActiveSubscription } from '@/core/billing/checkout';
//   import { getActiveSubscription } from '@/core/billing/subscriptions';
// Client-safe utilities like formatCurrency, centsToDollars can be imported from '@/core/billing'
export { formatCurrency, centsToDollars, dollarsToCents, getSubscriptionStatusLabel, getSubscriptionStatusColor, isSubscriptionActive } from './billing';

// Permissions
// Note: hasPermission and requirePermission are server-only and should be imported directly:
//   import { hasPermission } from '@/core/permissions/permissions';
//   import { requirePermission } from '@/core/permissions/middleware';
export { PermissionGate } from './permissions';

// Database
// Note: createClient and createAdminClient are server-only and should be imported directly:
//   import { createClient } from '@/core/database/server';
//   import { createAdminClient } from '@/core/database/admin-client';

// Shared
export { sleep, retry, isValidEmail, APP_CONFIG } from './shared';




