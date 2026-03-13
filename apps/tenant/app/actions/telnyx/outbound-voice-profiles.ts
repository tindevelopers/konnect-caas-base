"use server";

import { trackApiCall } from "@/src/core/telemetry";
import { createClient } from "@/core/database/server";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { getTelnyxTransport } from "./client";

const TELNYX_PROVIDER = "telnyx";

type TelnyxApiResponse<T> = { data: T; meta?: unknown };
type TelnyxListResponse<T> = { data: T[]; meta?: { total_results?: number; page_number?: number; page_size?: number } };

export type TelnyxOutboundVoiceProfile = {
  id: string;
  record_type?: "outbound_voice_profile";
  name: string;
  connections_count?: number;
  enabled?: boolean;
  whitelisted_destinations?: string[];
  service_plan?: string;
  traffic_type?: string;
  concurrent_call_limit?: number | null;
  created_at?: string;
  updated_at?: string;
};

async function getTelemetryContext() {
  let tenantId: string | null = null;
  let userId: string | null = null;
  try {
    tenantId = await ensureTenantId().catch(() => null);
  } catch {
    // Ignore
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {
    // Ignore
  }
  return { tenantId, userId };
}

/**
 * List outbound voice profiles (used by Call Control connections).
 * Needed so tenants can manage allowed destinations without Telnyx portal.
 */
export async function listOutboundVoiceProfilesAction(): Promise<{
  data: TelnyxOutboundVoiceProfile[];
  error?: string;
}> {
  try {
    const transport = await getTelnyxTransport("integrations.read");
    const res = await trackApiCall(
      "listOutboundVoiceProfiles",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxListResponse<TelnyxOutboundVoiceProfile>>("/outbound_voice_profiles", {
          method: "GET",
          query: { "page[size]": 100, sort: "name" },
        })
    );
    const list = Array.isArray(res?.data) ? res.data : [];
    return { data: list };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      return { data: [], error: "Provider API authentication failed. Check Telephony integration." };
    }
    if (message.includes("Tenant context missing")) {
      return { data: [], error: "Tenant context missing. Select a tenant or set platform Telephony integration." };
    }
    return { data: [], error: message };
  }
}

/**
 * Get a single outbound voice profile (e.g. to edit allowed destinations).
 */
export async function getOutboundVoiceProfileAction(profileId: string): Promise<{
  data: TelnyxOutboundVoiceProfile | null;
  error?: string;
}> {
  if (!profileId?.trim()) return { data: null, error: "Profile ID is required." };
  try {
    const transport = await getTelnyxTransport("integrations.read");
    const res = await trackApiCall(
      "getOutboundVoiceProfile",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxOutboundVoiceProfile>>(
          `/outbound_voice_profiles/${encodeURIComponent(profileId.trim())}`,
          { method: "GET" }
        )
    );
    const data = (res as { data?: TelnyxOutboundVoiceProfile })?.data ?? null;
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("404")) return { data: null, error: "Profile not found." };
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      return { data: null, error: "Provider API authentication failed. Check Telephony integration." };
    }
    if (message.includes("Tenant context missing")) {
      return { data: null, error: "Tenant context missing. Select a tenant or set platform Telephony integration." };
    }
    return { data: null, error: message };
  }
}

/**
 * Update an outbound voice profile's allowed destinations (whitelist).
 * Fixes D13: "Dialed number is not included in whitelisted countries".
 */
export async function updateOutboundVoiceProfileDestinationsAction(
  profileId: string,
  whitelisted_destinations: string[]
): Promise<{ data: TelnyxOutboundVoiceProfile | null; error?: string }> {
  if (!profileId?.trim()) return { data: null, error: "Profile ID is required." };
  const codes = whitelisted_destinations.filter((c) => typeof c === "string" && /^[A-Z]{2}$/.test(c));
  try {
    const transport = await getTelnyxTransport("integrations.write");
    const res = await trackApiCall(
      "updateOutboundVoiceProfile",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxOutboundVoiceProfile>>(
          `/outbound_voice_profiles/${encodeURIComponent(profileId.trim())}`,
          {
            method: "PATCH",
            body: { whitelisted_destinations: codes },
          }
        )
    );
    const data = (res as { data?: TelnyxOutboundVoiceProfile })?.data ?? null;
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("403")) {
      return {
        data: null,
        error:
          "Dialed number is not included in whitelisted countries. Add the destination country in Voice → Settings → Allowed Destinations.",
      };
    }
    if (message.includes("404")) return { data: null, error: "Profile not found." };
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      return { data: null, error: "Provider API authentication failed. Check Telephony integration." };
    }
    if (message.includes("Tenant context missing")) {
      return { data: null, error: "Tenant context missing. Select a tenant or set platform Telephony integration." };
    }
    return { data: null, error: message };
  }
}
