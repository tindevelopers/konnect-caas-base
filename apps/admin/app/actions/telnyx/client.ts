"use server";

import { createTelnyxClient, TelnyxTransport } from "@tinadmin/telnyx-ai-platform/server";
import {
  getIntegrationConfig,
  getPlatformIntegrationConfig,
} from "@/core/integrations";
import { getCurrentUserTenantId } from "@/core/multi-tenancy/validation";
import { requirePermission } from "@/core/permissions/middleware";

const TELNYX_PROVIDER = "telnyx";

function extractApiKey(credentials?: Record<string, unknown> | null) {
  if (!credentials) return undefined;
  if (typeof credentials.apiKey === "string") return credentials.apiKey;
  if (typeof credentials.api_key === "string") return credentials.api_key;
  return undefined;
}

/**
 * Resolves Telnyx API key in order: (1) tenant integration, (2) platform default, (3) TELNYX_API_KEY env.
 */
export async function getTelnyxTransport(
  requiredPermission: "integrations.read" | "integrations.write" = "integrations.read"
): Promise<TelnyxTransport> {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission(requiredPermission, { tenantId });

  const tenantConfig = await getIntegrationConfig(tenantId, TELNYX_PROVIDER);
  const tenantKey = extractApiKey(
    tenantConfig?.credentials as Record<string, unknown> | null | undefined
  );
  if (tenantKey) {
    return createTelnyxClient({ apiKey: tenantKey });
  }

  const platformConfig = await getPlatformIntegrationConfig(TELNYX_PROVIDER);
  const platformKey = extractApiKey(
    platformConfig?.credentials as Record<string, unknown> | null | undefined
  );
  if (platformKey) {
    return createTelnyxClient({ apiKey: platformKey });
  }

  const envKey = process.env.TELNYX_API_KEY;
  if (envKey) {
    return createTelnyxClient({ apiKey: envKey });
  }

  throw new Error(
    "Telnyx API key not configured. Set the system default (System Admin → Default Integrations), connect Telnyx for this organization (Integrations → Telephony → Telnyx), or set TELNYX_API_KEY."
  );
}
