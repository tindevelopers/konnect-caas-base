import "server-only";

import { createAdminClient } from "@/core/database/admin-client";
import { decryptIntegrationCredentials } from "@/core/integrations/crypto";
import {
  createTelnyxClient,
  type TelnyxTransport,
} from "@tinadmin/telnyx-ai-platform/server";

type TelnyxIntegrationCredentials = {
  apiKey?: string;
  api_key?: string;
};

export type TelnyxVoiceRoutingSettings = {
  voiceRouting?: {
    inboundAssistantId?: string;
    operatorSipUri?: string;
    escapeDigit?: string;
    greeting?: string;
  };
};

function extractApiKey(credentials: unknown): string | null {
  if (!credentials || typeof credentials !== "object") return null;
  const c = credentials as TelnyxIntegrationCredentials;
  if (typeof c.apiKey === "string" && c.apiKey.trim()) return c.apiKey.trim();
  if (typeof c.api_key === "string" && c.api_key.trim()) return c.api_key.trim();
  return null;
}

export async function getTelnyxIntegrationForWebhook(tenantId: string): Promise<{
  credentials: Record<string, unknown> | null;
  settings: TelnyxVoiceRoutingSettings | null;
}> {
  if (!tenantId?.trim()) {
    throw new Error("tenantId is required");
  }

  const admin = createAdminClient();
  // Supabase types for jsonb are often inferred as never; assert to avoid build breaks.
  const { data, error } = await (admin.from("integration_configs") as any)
    .select("credentials, settings, status")
    .eq("tenant_id", tenantId)
    .eq("provider", "telnyx")
    .single();

  if (error) {
    // PGRST116 = no rows returned (common when tenant hasn't connected Telnyx).
    if (String((error as any).code || "") === "PGRST116") {
      return { credentials: null, settings: null };
    }
    throw new Error(error.message || "Failed to load Telnyx integration config");
  }

  const decrypted =
    (decryptIntegrationCredentials(
      data?.credentials as Record<string, unknown>
    ) as Record<string, unknown> | null) ?? null;

  const settings =
    (data?.settings && typeof data.settings === "object"
      ? (data.settings as TelnyxVoiceRoutingSettings)
      : null) ?? null;

  return { credentials: decrypted, settings };
}

export type TelnyxCredentialSource = "tenant" | "env";

export async function getTelnyxTransportForWebhook(tenantId: string): Promise<{
  transport: TelnyxTransport;
  settings: TelnyxVoiceRoutingSettings | null;
  credentialSource: TelnyxCredentialSource;
}> {
  const { credentials, settings } = await getTelnyxIntegrationForWebhook(tenantId);
  const tenantKey = extractApiKey(credentials);
  const envKey = process.env.TELNYX_API_KEY?.trim() || null;
  // Prefer TELNYX_API_KEY when set so Vercel env overrides stale tenant credentials
  const apiKey = envKey ?? tenantKey ?? null;
  const credentialSource: TelnyxCredentialSource = envKey ? "env" : "tenant";

  if (!apiKey) {
    throw new Error(
      "Telnyx API key not configured for this tenant. Connect Telnyx under Integrations → Telephony → Telnyx, or set TELNYX_API_KEY."
    );
  }

  return {
    transport: createTelnyxClient({ apiKey }),
    settings,
    credentialSource: credentialSource as TelnyxCredentialSource,
  };
}

