"use server";

import { createTelnyxClient, TelnyxTransport } from "@tinadmin/telnyx-ai-platform/server";
import { getIntegrationConfig } from "@/core/integrations";
import { getCurrentUserTenantId } from "@/core/multi-tenancy/validation";
import { requirePermission } from "@/core/permissions/middleware";

const TELNYX_PROVIDER = "telnyx";

function extractApiKey(credentials?: Record<string, unknown> | null) {
  if (!credentials) return undefined;
  if (typeof credentials.apiKey === "string") return credentials.apiKey;
  if (typeof credentials.api_key === "string") return credentials.api_key;
  return undefined;
}

export async function getTelnyxTransport(
  requiredPermission: "integrations.read" | "integrations.write" = "integrations.read"
): Promise<TelnyxTransport> {
  const tenantId = await getCurrentUserTenantId();
  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  await requirePermission(requiredPermission, { tenantId });

  const config = await getIntegrationConfig(tenantId, TELNYX_PROVIDER);
  const tenantKey = extractApiKey(
    config?.credentials as Record<string, unknown> | null | undefined
  );
  const apiKey = tenantKey || process.env.TELNYX_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Telnyx API key not configured. Connect a tenant Telnyx integration or set TELNYX_API_KEY."
    );
  }

  return createTelnyxClient({ apiKey });
}
