"use server";

import { trackApiCall } from "@/src/core/telemetry";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { getTwilioCredentials, twilioRequest, type TwilioCredentials } from "./client";

const TWILIO_PROVIDER = "twilio";

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

function normalizeE164(value: string): string {
  const t = value.trim();
  return t.startsWith("+") ? t : `+${t}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TwilioAvailablePhoneNumber = {
  phone_number: string;
  friendly_name: string;
  iso_country: string;
  region?: string;
  locality?: string;
  postal_code?: string;
  rate_center?: string;
  lata?: string;
  latitude?: string;
  longitude?: string;
  capabilities: {
    voice?: boolean;
    SMS?: boolean;
    MMS?: boolean;
    fax?: boolean;
  };
  beta?: boolean;
};

export type TwilioOwnedPhoneNumber = {
  sid: string;
  phone_number: string;
  friendly_name: string;
  status?: string;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
    fax?: boolean;
  };
  date_created?: string;
  date_updated?: string;
  voice_url?: string;
  sms_url?: string;
};

// ---------------------------------------------------------------------------
// Search available numbers
// ---------------------------------------------------------------------------

export async function searchTwilioAvailableNumbersAction(args: {
  countryCode: string;
  phoneNumberType?: string;
  areaCode?: string;
  contains?: string;
  locality?: string;
  region?: string;
  smsEnabled?: boolean;
  mmsEnabled?: boolean;
  voiceEnabled?: boolean;
  limit?: number;
}): Promise<
  { ok: true; data: TwilioAvailablePhoneNumber[] } | { ok: false; error: string }
> {
  const { tenantId, userId } = await getTelemetryContext();

  try {
    const creds = await getTwilioCredentials("integrations.read");
    const country = args.countryCode.trim().toUpperCase();
    if (!country) return { ok: false, error: "Country code is required." };

    const typeSegment = mapPhoneNumberType(args.phoneNumberType);

    const params = new URLSearchParams();
    if (args.areaCode?.trim()) params.set("AreaCode", args.areaCode.trim());
    if (args.contains?.trim()) params.set("Contains", args.contains.trim());
    if (args.locality?.trim()) params.set("InLocality", args.locality.trim());
    if (args.region?.trim()) params.set("InRegion", args.region.trim());
    if (args.smsEnabled) params.set("SmsEnabled", "true");
    if (args.mmsEnabled) params.set("MmsEnabled", "true");
    if (args.voiceEnabled) params.set("VoiceEnabled", "true");
    params.set("PageSize", String(Math.min(args.limit ?? 50, 100)));

    const qs = params.toString();
    const path = `/AvailablePhoneNumbers/${country}/${typeSegment}.json${qs ? `?${qs}` : ""}`;

    const result = await trackApiCall(
      "searchTwilioAvailableNumbers",
      TWILIO_PROVIDER,
      async () => {
        return twilioRequest<{ available_phone_numbers: TwilioAvailablePhoneNumber[] }>(
          creds,
          path
        );
      },
      { tenantId, userId, requestData: { countryCode: country, type: typeSegment } }
    );

    return { ok: true, data: result.available_phone_numbers ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Search failed" };
  }
}

function mapPhoneNumberType(type?: string): string {
  switch (type?.toLowerCase()) {
    case "toll_free":
    case "tollfree":
      return "TollFree";
    case "mobile":
      return "Mobile";
    case "local":
    default:
      return "Local";
  }
}

// ---------------------------------------------------------------------------
// Purchase (provision) a Twilio number and wire to platform
// ---------------------------------------------------------------------------

export async function purchaseTwilioNumberAction(args: {
  phoneNumber: string;
  friendlyName?: string;
  voiceWebhookUrl?: string;
}): Promise<
  { ok: true; data: TwilioOwnedPhoneNumber } | { ok: false; error: string }
> {
  const { tenantId, userId } = await getTelemetryContext();

  try {
    const creds = await getTwilioCredentials("integrations.write");
    const phoneNumber = normalizeE164(args.phoneNumber);
    if (!phoneNumber) return { ok: false, error: "Phone number is required." };

    const body: Record<string, string> = {
      PhoneNumber: phoneNumber,
    };
    if (args.friendlyName?.trim()) body.FriendlyName = args.friendlyName.trim();
    if (args.voiceWebhookUrl?.trim()) body.VoiceUrl = args.voiceWebhookUrl.trim();

    const result = await trackApiCall(
      "purchaseTwilioNumber",
      TWILIO_PROVIDER,
      async () => {
        return twilioRequest<TwilioOwnedPhoneNumber>(creds, "/IncomingPhoneNumbers.json", {
          method: "POST",
          body,
        });
      },
      { tenantId, userId, requestData: { phoneNumber } }
    );

    // Wire to platform: insert into tenant_phone_numbers
    if (tenantId) {
      await registerNumberOnPlatform({
        tenantId,
        phoneNumberE164: phoneNumber,
        supplier: "twilio",
        externalId: result.sid,
        friendlyName: result.friendly_name,
        capabilities: result.capabilities ?? {},
        countryCode: null,
        phoneNumberType: null,
      });
    }

    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Purchase failed" };
  }
}

// ---------------------------------------------------------------------------
// Add existing Twilio number to platform (no purchase, just register)
// ---------------------------------------------------------------------------

export async function addExistingTwilioNumberAction(args: {
  phoneNumber: string;
  twilioSid?: string;
  friendlyName?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tenantId = await ensureTenantId();
    const phoneNumber = normalizeE164(args.phoneNumber);
    if (!phoneNumber) return { ok: false, error: "Phone number is required." };

    await registerNumberOnPlatform({
      tenantId,
      phoneNumberE164: phoneNumber,
      supplier: "twilio",
      externalId: args.twilioSid ?? null,
      friendlyName: args.friendlyName ?? null,
      capabilities: {},
      countryCode: null,
      phoneNumberType: null,
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add number" };
  }
}

// ---------------------------------------------------------------------------
// List owned Twilio numbers (from Twilio API)
// ---------------------------------------------------------------------------

export async function listOwnedTwilioNumbersAction(args?: {
  phoneNumberContains?: string;
  pageSize?: number;
}): Promise<
  { ok: true; data: TwilioOwnedPhoneNumber[] } | { ok: false; error: string }
> {
  const { tenantId, userId } = await getTelemetryContext();

  try {
    const creds = await getTwilioCredentials("integrations.read");

    const params = new URLSearchParams();
    if (args?.phoneNumberContains?.trim()) {
      params.set("PhoneNumber", args.phoneNumberContains.trim());
    }
    params.set("PageSize", String(Math.min(args?.pageSize ?? 50, 100)));

    const qs = params.toString();
    const path = `/IncomingPhoneNumbers.json${qs ? `?${qs}` : ""}`;

    const result = await trackApiCall(
      "listOwnedTwilioNumbers",
      TWILIO_PROVIDER,
      async () => {
        return twilioRequest<{ incoming_phone_numbers: TwilioOwnedPhoneNumber[] }>(
          creds,
          path
        );
      },
      { tenantId, userId }
    );

    return { ok: true, data: result.incoming_phone_numbers ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to list numbers" };
  }
}

// ---------------------------------------------------------------------------
// Configure Twilio number webhook (point voice URL to our platform)
// ---------------------------------------------------------------------------

export async function configureTwilioNumberWebhookAction(args: {
  twilioSid: string;
  voiceUrl: string;
  statusCallbackUrl?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const creds = await getTwilioCredentials("integrations.write");

    const body: Record<string, string> = {
      VoiceUrl: args.voiceUrl,
      VoiceMethod: "POST",
    };
    if (args.statusCallbackUrl?.trim()) {
      body.StatusCallback = args.statusCallbackUrl.trim();
      body.StatusCallbackMethod = "POST";
    }

    await twilioRequest(creds, `/IncomingPhoneNumbers/${args.twilioSid}.json`, {
      method: "POST",
      body,
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to configure webhook" };
  }
}

// ---------------------------------------------------------------------------
// Platform number registry helpers
// ---------------------------------------------------------------------------

async function registerNumberOnPlatform(args: {
  tenantId: string;
  phoneNumberE164: string;
  supplier: string;
  externalId: string | null;
  friendlyName: string | null;
  capabilities: Record<string, unknown>;
  countryCode: string | null;
  phoneNumberType: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await (admin.from("tenant_phone_numbers") as any).upsert(
    {
      tenant_id: args.tenantId,
      phone_number_e164: args.phoneNumberE164,
      supplier: args.supplier,
      external_id: args.externalId,
      friendly_name: args.friendlyName,
      capabilities: args.capabilities,
      country_code: args.countryCode,
      phone_number_type: args.phoneNumberType,
      status: "active",
    },
    { onConflict: "tenant_id,phone_number_e164" }
  );
  if (error) {
    console.error("[registerNumberOnPlatform]", error);
    throw new Error(error.message || "Failed to register number on platform");
  }
}

// ---------------------------------------------------------------------------
// List platform-registered numbers for a tenant (from DB, not Twilio API)
// ---------------------------------------------------------------------------

export async function listPlatformNumbersAction(args?: {
  supplier?: string;
}): Promise<
  {
    ok: true;
    data: Array<{
      id: string;
      phone_number_e164: string;
      supplier: string;
      external_id: string | null;
      friendly_name: string | null;
      status: string;
      capabilities: Record<string, unknown>;
      country_code: string | null;
      phone_number_type: string | null;
      created_at: string;
    }>;
  } | { ok: false; error: string }
> {
  try {
    const tenantId = await ensureTenantId();
    const supabase = await createClient();

    let query = (supabase.from("tenant_phone_numbers") as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (args?.supplier?.trim()) {
      query = query.eq("supplier", args.supplier.trim());
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return { ok: true, data: data ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to list numbers" };
  }
}
