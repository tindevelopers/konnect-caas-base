import "server-only";

import { createAdminClient } from "@/core/database/admin-client";

function normalizeE164(value: string): string {
  const t = value.trim();
  return t.startsWith("+") ? t : `+${t}`;
}

export type VoiceRoutingInfo = {
  assistantId: string;
  supplier: string;
};

/**
 * Returns the tenant-scoped assistant ID for inbound voice for the given number, if set.
 * Used by the voice router when handling call.initiated / call.answered.
 */
export async function getInboundAssistantIdForNumber(
  tenantId: string,
  phoneNumberE164: string
): Promise<string | null> {
  const routing = await getInboundVoiceRoutingForNumber(tenantId, phoneNumberE164);
  return routing?.assistantId ?? null;
}

/**
 * Returns full voice routing info (assistant + supplier) for a number.
 * Used by both Telnyx and Twilio webhook handlers.
 */
export async function getInboundVoiceRoutingForNumber(
  tenantId: string,
  phoneNumberE164: string
): Promise<VoiceRoutingInfo | null> {
  if (!tenantId?.trim() || !phoneNumberE164?.trim()) return null;
  const key = normalizeE164(phoneNumberE164);
  const admin = createAdminClient();
  const { data, error } = await (admin.from("tenant_phone_number_voice_agents") as any)
    .select("telnyx_assistant_id, supplier")
    .eq("tenant_id", tenantId)
    .eq("phone_number_e164", key)
    .maybeSingle();
  if (error || !data?.telnyx_assistant_id) return null;
  return {
    assistantId: data.telnyx_assistant_id as string,
    supplier: (data.supplier as string) || "telnyx",
  };
}

/**
 * Resolve tenant ID from a phone number via the tenant_phone_numbers registry.
 * Used by Twilio webhook to identify which tenant owns the called number.
 */
export async function resolveTenantIdFromNumber(
  phoneNumberE164: string
): Promise<string | null> {
  if (!phoneNumberE164?.trim()) return null;
  const key = normalizeE164(phoneNumberE164);
  const admin = createAdminClient();
  const { data, error } = await (admin.from("tenant_phone_numbers") as any)
    .select("tenant_id")
    .eq("phone_number_e164", key)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data?.tenant_id) return null;
  return data.tenant_id as string;
}
