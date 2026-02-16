"use server";

import { createTelnyxClient, TelnyxTransport } from "@tinadmin/telnyx-ai-platform/server";
import {
  getIntegrationConfig,
  getPlatformIntegrationConfig,
} from "@/core/integrations";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { requirePermission } from "@/core/permissions/middleware";
import { isPlatformAdmin } from "@/core/database/organization-admins";
import { trackApiCall } from "@/src/core/telemetry";
import { createClient } from "@/core/database/server";

const TELNYX_PROVIDER = "telnyx";

export type TelnyxCredentialSource = "tenant" | "shared";

export interface TelnyxTransportWithSource {
  transport: TelnyxTransport;
  credentialSource: TelnyxCredentialSource;
}

function extractApiKey(credentials?: Record<string, unknown> | null) {
  if (!credentials) return undefined;
  if (typeof credentials.apiKey === "string") return credentials.apiKey;
  if (typeof credentials.api_key === "string") return credentials.api_key;
  return undefined;
}

/**
 * Resolves Telnyx API key and credential source.
 * Resolution order: (1) tenant integration, (2) TELNYX_API_KEY env, (3) platform default.
 *
 * Returns both the transport and the credential source:
 * - "tenant": tenant has their own Telnyx account (enterprise) — assistants are isolated by account
 * - "shared": using env or platform default — assistants must be filtered via tenant_ai_assistants
 */
export async function getTelnyxTransportWithSource(
  requiredPermission: "integrations.read" | "integrations.write" = "integrations.read"
): Promise<TelnyxTransportWithSource> {
  // Get user ID for telemetry
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {
    // Ignore auth errors
  }

  return trackApiCall(
    "getTelnyxTransport",
    TELNYX_PROVIDER,
    async () => {
      const isAdmin = await isPlatformAdmin();
      let tenantId: string | null = null;

      // Try to get tenant ID, but don't fail if Platform Admin hasn't selected one
      try {
        tenantId = await ensureTenantId();
      } catch (e) {
        if (!isAdmin) {
          throw new Error("Tenant context missing");
        }
        // Platform Admin without tenant selected - will use platform defaults
      }

      // Check permissions if we have a tenant ID
      if (tenantId) {
        await requirePermission(requiredPermission, { tenantId });
      } else if (isAdmin) {
        // Platform Admins can access platform defaults without tenant context
      } else {
        throw new Error("Tenant context missing");
      }

      // If we have a tenant ID, try tenant-specific config FIRST
      // This takes priority because it means the tenant has their own Telnyx account
      if (tenantId) {
        const tenantConfig = await getIntegrationConfig(tenantId, TELNYX_PROVIDER);
        const tenantKey = extractApiKey(
          tenantConfig?.credentials as Record<string, unknown> | null | undefined
        );
        if (tenantKey) {
          return {
            transport: createTelnyxClient({ apiKey: tenantKey }),
            credentialSource: "tenant" as TelnyxCredentialSource,
          };
        }
      }

      // Environment variable (shared — used by all tenants without their own config)
      const envKey = process.env.TELNYX_API_KEY;
      const hasEnvKey = !!(envKey && envKey.trim().length >= 10);
      if (hasEnvKey) {
        return {
          transport: createTelnyxClient({ apiKey: envKey!.trim() }),
          credentialSource: "shared" as TelnyxCredentialSource,
        };
      }

      // Fall back to platform default (shared)
      let platformKey: string | undefined;
      try {
        const platformConfig = await getPlatformIntegrationConfig(TELNYX_PROVIDER);
        platformKey = extractApiKey(
          platformConfig?.credentials as Record<string, unknown> | null | undefined
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const isConfigEnvError =
          /INTEGRATION_CREDENTIALS_KEY|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/i.test(errMsg);
        if (isConfigEnvError) {
          platformKey = undefined;
        } else {
          throw e;
        }
      }
      if (platformKey) {
        if (platformKey.length < 10) {
          throw new Error(
            `Invalid Telnyx API key format. The key appears to be too short (${platformKey.length} chars). ` +
            `Please verify your API key in System Admin → Integrations → Telnyx`
          );
        }
        return {
          transport: createTelnyxClient({ apiKey: platformKey }),
          credentialSource: "shared" as TelnyxCredentialSource,
        };
      }

      throw new Error(
        "Telnyx API key not configured. Set TELNYX_API_KEY in .env.local, set the system default (System Admin → Integrations), or connect Telnyx for this organization (Integrations → Telephony → Telnyx)."
      );
    },
    {
      tenantId: null, // Will be resolved inside
      userId,
      metadata: {
        permission: requiredPermission,
      },
    }
  );
}

/**
 * Backward-compatible wrapper that returns only the TelnyxTransport.
 */
export async function getTelnyxTransport(
  requiredPermission: "integrations.read" | "integrations.write" = "integrations.read"
): Promise<TelnyxTransport> {
  const result = await getTelnyxTransportWithSource(requiredPermission);
  return result.transport;
}
