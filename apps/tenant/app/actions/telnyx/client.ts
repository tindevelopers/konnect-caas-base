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

function extractApiKey(credentials?: Record<string, unknown> | null) {
  if (!credentials) return undefined;
  if (typeof credentials.apiKey === "string") return credentials.apiKey;
  if (typeof credentials.api_key === "string") return credentials.api_key;
  return undefined;
}

/**
 * Resolves Telnyx API key in order: (1) tenant integration, (2) platform default, (3) TELNYX_API_KEY env.
 * Platform Admins can use platform defaults without selecting a tenant.
 */
export async function getTelnyxTransport(
  requiredPermission: "integrations.read" | "integrations.write" = "integrations.read"
): Promise<TelnyxTransport> {
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
      } catch {
        // If not a Platform Admin and no tenant ID, we'll throw below
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
        // Skip permission check for platform-level operations
      } else {
        throw new Error("Tenant context missing");
      }

      // If we have a tenant ID, try tenant-specific config first
      if (tenantId) {
        const tenantConfig = await getIntegrationConfig(tenantId, TELNYX_PROVIDER);
        const tenantKey = extractApiKey(
          tenantConfig?.credentials as Record<string, unknown> | null | undefined
        );
        if (tenantKey) {
          return createTelnyxClient({ apiKey: tenantKey });
        }
      }

      // Fall back to platform default
      const platformConfig = await getPlatformIntegrationConfig(TELNYX_PROVIDER);
      const platformKey = extractApiKey(
        platformConfig?.credentials as Record<string, unknown> | null | undefined
      );
      if (platformKey) {
        // Validate API key format (Telnyx API keys typically start with "KEY" or are 20+ chars)
        if (platformKey.length < 10) {
          throw new Error(
            `Invalid Telnyx API key format. The key appears to be too short (${platformKey.length} chars). ` +
            `Please verify your API key in System Admin → Integrations → Telnyx`
          );
        }
        return createTelnyxClient({ apiKey: platformKey });
      }

      // Final fallback to environment variable
      const envKey = process.env.TELNYX_API_KEY;
      if (envKey) {
        return createTelnyxClient({ apiKey: envKey });
      }

      throw new Error(
        "Telnyx API key not configured. Set the system default (System Admin → Integrations), connect Telnyx for this organization (Integrations → Telephony → Telnyx), or set TELNYX_API_KEY."
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
