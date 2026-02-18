import "server-only";

import { createAdminClient } from "@/core/database/admin-client";

function normalizeE164(value: string): string {
  const t = value.trim();
  return t.startsWith("+") ? t : `+${t}`;
}

/**
 * Returns the tenant-scoped assistant ID for inbound voice for the given number, if set.
 * Used by the voice router when handling call.initiated / call.answered.
 */
export async function getInboundAssistantIdForNumber(
  tenantId: string,
  phoneNumberE164: string
): Promise<string | null> {
  if (!tenantId?.trim() || !phoneNumberE164?.trim()) return null;
  const key = normalizeE164(phoneNumberE164);
  const admin = createAdminClient();
  const { data, error } = await (admin.from("tenant_phone_number_voice_agents") as any)
    .select("telnyx_assistant_id")
    .eq("tenant_id", tenantId)
    .eq("phone_number_e164", key)
    .maybeSingle();
  if (error || !data?.telnyx_assistant_id) return null;
  return data.telnyx_assistant_id as string;
}
