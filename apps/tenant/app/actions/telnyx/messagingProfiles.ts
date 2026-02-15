"use server";

import { trackApiCall } from "@/src/core/telemetry";
import { createClient } from "@/core/database/server";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { getTelnyxTransport } from "./client";

const TELNYX_PROVIDER = "telnyx";

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

export type TelnyxMessagingProfile = {
  record_type: "messaging_profile";
  id: string;
  name: string;
  enabled?: boolean;
  webhook_url?: string | null;
  webhook_failover_url?: string | null;
  webhook_api_version?: "1" | "2" | "2010-04-01";
  whitelisted_destinations?: string[];
  alpha_sender?: string | null;
  number_pool_settings?: {
    toll_free_weight?: number;
    long_code_weight?: number;
    skip_unhealthy?: boolean;
    sticky_sender?: boolean;
    geomatch?: boolean;
  } | null;
  url_shortener_settings?: {
    domain?: string;
    prefix?: string;
    replace_blacklist_only?: boolean;
    send_webhooks?: boolean;
  } | null;
  mms_fall_back_to_sms?: boolean;
  mms_transcoding?: boolean;
  daily_spend_limit?: string;
  daily_spend_limit_enabled?: boolean;
  mobile_only?: boolean;
  smart_encoding?: boolean;
  created_at?: string;
  updated_at?: string;
  v1_secret?: string;
};

type TelnyxApiResponse<T> = { data: T };
type TelnyxListResponse<T> = { data: T[]; meta?: unknown };

function enhanceTelnyxError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }

  // Keep patterns consistent with assistants.ts
  if (error.message.includes("401") || error.message.toLowerCase().includes("unauthorized")) {
    return new Error(
      "Telnyx API authentication failed (401). Please verify your API key is valid and has the correct permissions. " +
        "Check your Telnyx API key in System Admin → Integrations → Telnyx"
    );
  }

  if (error.message.includes("Tenant context missing")) {
    return new Error(
      "Tenant context missing. Please select a tenant or configure the platform default Telnyx integration."
    );
  }

  return error;
}

export async function listMessagingProfilesAction() {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "listMessagingProfiles",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxListResponse<TelnyxMessagingProfile>>("/messaging_profiles", {
          method: "GET",
        });
      },
      { tenantId, userId }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type CreateMessagingProfileRequest = {
  name: string;
  webhook_api_version?: "1" | "2" | "2010-04-01";
};

export async function createMessagingProfileAction(payload: CreateMessagingProfileRequest) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "createMessagingProfile",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxMessagingProfile>>("/messaging_profiles", {
          method: "POST",
          body: payload,
        });
      },
      {
        tenantId,
        userId,
        requestData: { name: payload.name, webhook_api_version: payload.webhook_api_version },
      }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type UpdateMessagingProfilePatch = Partial<
  Pick<
    TelnyxMessagingProfile,
    | "name"
    | "enabled"
    | "webhook_url"
    | "webhook_failover_url"
    | "webhook_api_version"
    | "whitelisted_destinations"
    | "alpha_sender"
    | "number_pool_settings"
    | "url_shortener_settings"
    | "daily_spend_limit"
    | "daily_spend_limit_enabled"
    | "mms_fall_back_to_sms"
    | "mms_transcoding"
    | "mobile_only"
    | "smart_encoding"
  >
>;

export async function updateMessagingProfileAction(profileId: string, patch: UpdateMessagingProfilePatch) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "updateMessagingProfile",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxMessagingProfile>>(
          `/messaging_profiles/${profileId}`,
          {
            method: "PATCH",
            body: patch,
          }
        );
      },
      {
        tenantId,
        userId,
        requestData: { profileId, patchKeys: Object.keys(patch) },
      }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function getMessagingProfileAction(profileId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "getMessagingProfile",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxMessagingProfile>>(
          `/messaging_profiles/${profileId}`,
          { method: "GET" }
        );
      },
      { tenantId, userId, requestData: { profileId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type TelnyxMessagingPhoneNumberSettings = {
  record_type: "messaging_settings";
  id: string;
  phone_number: string;
  messaging_profile_id?: string | null;
  traffic_type?: string | null;
  messaging_product?: string | null;
  type?: string | null;
  country_code?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function listMessagingProfilePhoneNumbersAction(profileId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "listMessagingProfilePhoneNumbers",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxListResponse<TelnyxMessagingPhoneNumberSettings>>(
          `/messaging_profiles/${profileId}/phone_numbers`,
          { method: "GET" }
        );
      },
      { tenantId, userId, requestData: { profileId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type AssignPhoneNumberToMessagingProfileRequest = {
  messaging_profile_id: string;
  messaging_product?: string | null;
};

export async function assignPhoneNumberToMessagingProfileAction(
  phoneNumberId: string,
  payload: AssignPhoneNumberToMessagingProfileRequest
) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "assignPhoneNumberToMessagingProfile",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxMessagingPhoneNumberSettings>>(
          `/phone_numbers/${phoneNumberId}/messaging`,
          {
            method: "PATCH",
            body: payload,
          }
        );
      },
      {
        tenantId,
        userId,
        requestData: {
          phoneNumberId,
          messaging_profile_id: payload.messaging_profile_id,
          hasMessagingProduct: Boolean(payload.messaging_product),
        },
      }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type CreateAutorespConfigRequest = {
  op: "start" | "stop" | "help" | string;
  keywords: string[];
  resp_text: string;
  country_code?: string;
};

export type TelnyxAutorespConfig = {
  id: string;
  op: string;
  keywords: string[];
  resp_text: string;
  country_code?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function createAutorespConfigAction(profileId: string, payload: CreateAutorespConfigRequest) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "createAutorespConfig",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxAutorespConfig>>(
          `/messaging_profiles/${profileId}/autoresp_configs`,
          {
            method: "POST",
            body: payload,
          }
        );
      },
      {
        tenantId,
        userId,
        requestData: {
          profileId,
          op: payload.op,
          keywordsCount: payload.keywords?.length ?? 0,
          hasCountry: Boolean(payload.country_code),
        },
      }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

