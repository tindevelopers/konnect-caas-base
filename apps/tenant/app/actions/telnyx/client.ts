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
 * Resolves Telnyx API key in order: (1) TELNYX_API_KEY env, (2) tenant integration, (3) platform default.
 * Env takes precedence so local .env.local overrides DB config. Platform Admins can use platform defaults without selecting a tenant.
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
      // #region agent log
      fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "client.ts:getTelnyxTransport",
          message: "entry",
          data: { perm: requiredPermission },
          timestamp: Date.now(),
          hypothesisId: "B",
          runId: "getTransport",
        }),
      }).catch(() => {});
      // #endregion
      const isAdmin = await isPlatformAdmin();
      let tenantId: string | null = null;

      // Try to get tenant ID, but don't fail if Platform Admin hasn't selected one
      try {
        tenantId = await ensureTenantId();
      } catch (e) {
        // #region agent log
        fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "client.ts:getTelnyxTransport",
            message: "ensureTenantId threw",
            data: { isAdmin, err: e instanceof Error ? e.message : String(e).slice(0, 80) },
            timestamp: Date.now(),
            hypothesisId: "B",
            runId: "getTransport",
          }),
        }).catch(() => {});
        // #endregion
        // If not a Platform Admin and no tenant ID, we'll throw below
        if (!isAdmin) {
          throw new Error("Tenant context missing");
        }
        // Platform Admin without tenant selected - will use platform defaults
      }

      // #region agent log
      fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "client.ts:getTelnyxTransport",
          message: "after ensureTenantId",
          data: { hasTenantId: !!tenantId },
          timestamp: Date.now(),
          hypothesisId: "B",
          runId: "getTransport",
        }),
      }).catch(() => {});
      // #endregion

      // Check permissions if we have a tenant ID
      if (tenantId) {
        await requirePermission(requiredPermission, { tenantId });
      } else if (isAdmin) {
        // Platform Admins can access platform defaults without tenant context
        // Skip permission check for platform-level operations
      } else {
        throw new Error("Tenant context missing");
      }

      // Environment variable takes precedence (e.g. for local dev / overrides)
      const envKey = process.env.TELNYX_API_KEY;
      const hasEnvKey = !!(envKey && envKey.trim().length >= 10);
      // #region agent log
      fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "client.ts:getTelnyxTransport",
          message: "env key check",
          data: { hasEnvKey },
          timestamp: Date.now(),
          hypothesisId: "C",
          runId: "getTransport",
        }),
      }).catch(() => {});
      // #endregion
      if (hasEnvKey) {
        return createTelnyxClient({ apiKey: envKey!.trim() });
      }

      // If we have a tenant ID, try tenant-specific config
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
      let platformKey: string | undefined;
      try {
        const platformConfig = await getPlatformIntegrationConfig(TELNYX_PROVIDER);
        platformKey = extractApiKey(
          platformConfig?.credentials as Record<string, unknown> | null | undefined
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        // #region agent log
        fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "client.ts:getTelnyxTransport",
            message: "getPlatformIntegrationConfig threw",
            data: { errMsg: errMsg.slice(0, 100) },
            timestamp: Date.now(),
            hypothesisId: "C",
            runId: "getTransport",
          }),
        }).catch(() => {});
        // #endregion
        // On Vercel/production, missing INTEGRATION_CREDENTIALS_KEY or Supabase env causes
        // getPlatformIntegrationConfig to throw; treat as "no platform key" so we surface the
        // friendly "Telnyx API key not configured" instead of a masked server error.
        const isConfigEnvError =
          /INTEGRATION_CREDENTIALS_KEY|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/i.test(errMsg);
        if (isConfigEnvError) {
          platformKey = undefined;
        } else {
          throw e;
        }
      }
      // #region agent log
      fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "client.ts:getTelnyxTransport",
          message: "after platform config",
          data: { hasPlatformKey: !!platformKey },
          timestamp: Date.now(),
          hypothesisId: "D",
          runId: "getTransport",
        }),
      }).catch(() => {});
      // #endregion
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
