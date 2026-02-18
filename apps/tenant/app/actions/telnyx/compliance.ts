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
    /* ignore */
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {
    /* ignore */
  }
  return { tenantId, userId };
}

function enhanceTelnyxError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error(String(error));
  if (error.message.includes("401") || error.message.toLowerCase().includes("unauthorized")) {
    return new Error(
      "Provider API authentication failed (401). Verify your API key in System Admin → Integrations → Telephony"
    );
  }
  if (error.message.includes("Tenant context missing")) {
    return new Error(
      "Tenant context missing. Please select a tenant or configure the platform default telephony integration."
    );
  }
  return error;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TelnyxApiResponse<T> = { data: T };
type TelnyxListResponse<T> = { data: T[]; meta?: unknown };

// 10DLC Brand
export type TelnyxBrand = {
  brandId?: string;
  entityType?: string;
  displayName?: string;
  companyName?: string;
  ein?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  website?: string;
  vertical?: string;
  brandRelationship?: string;
  identityStatus?: string;
  vettingStatus?: string;
  vettingScore?: number;
  cspId?: string;
  createdDate?: string;
  [key: string]: unknown;
};

// 10DLC Campaign
export type TelnyxCampaign = {
  campaignId?: string;
  brandId?: string;
  cspId?: string;
  usecase?: string;
  description?: string;
  subUsecases?: string[];
  resellerId?: string;
  status?: string;
  createDate?: string;
  autoRenewal?: boolean;
  billedDate?: string;
  mnoMetadata?: Record<string, unknown>;
  sample1?: string;
  sample2?: string;
  sample3?: string;
  sample4?: string;
  sample5?: string;
  messageFlow?: string;
  helpMessage?: string;
  optinKeywords?: string;
  optoutKeywords?: string;
  optinMessage?: string;
  optoutMessage?: string;
  helpKeywords?: string;
  numberPool?: boolean;
  directLending?: boolean;
  subscriberOptin?: boolean;
  subscriberOptout?: boolean;
  subscriberHelp?: boolean;
  ageGated?: boolean;
  embeddedLink?: boolean;
  embeddedPhone?: boolean;
  affiliateMarketing?: boolean;
  [key: string]: unknown;
};

// Phone Number Campaign
export type TelnyxPhoneNumberCampaign = {
  phoneNumber?: string;
  campaignId?: string;
  [key: string]: unknown;
};

// Toll-Free Verification
export type TelnyxTollFreeVerification = {
  id?: string;
  verificationRequestId?: string;
  verificationStatus?: string;
  businessName?: string;
  corporateWebsite?: string;
  businessAddr1?: string;
  businessAddr2?: string;
  businessCity?: string;
  businessState?: string;
  businessZip?: string;
  businessContactFirstName?: string;
  businessContactLastName?: string;
  businessContactEmail?: string;
  businessContactPhone?: string;
  messageVolume?: string;
  phoneNumbers?: Array<{ phoneNumber: string }>;
  useCase?: string;
  useCaseSummary?: string;
  productionMessageContent?: string;
  optInWorkflow?: string;
  optInWorkflowImageURLs?: Array<{ url: string }>;
  additionalInformation?: string;
  isvReseller?: string;
  webhookUrl?: string;
  businessRegistrationNumber?: string;
  businessRegistrationType?: string;
  businessRegistrationCountry?: string;
  doingBusinessAs?: string;
  entityType?: string;
  optInConfirmationResponse?: string;
  helpMessageResponse?: string;
  privacyPolicyURL?: string;
  termsAndConditionURL?: string;
  ageGatedContent?: boolean;
  optInKeywords?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

// Opt-Out
export type TelnyxOptOut = {
  messaging_profile_id?: string;
  from?: string;
  to?: string;
  created_at?: string;
  [key: string]: unknown;
};

// ─── 10DLC Brand Actions ──────────────────────────────────────────────────────

export async function listBrandsAction() {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "list10DLCBrands",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxListResponse<TelnyxBrand>>("/10dlc/brand", {
          method: "GET",
        }),
      { tenantId, userId }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type CreateBrandRequest = {
  entityType: string;
  displayName: string;
  companyName?: string;
  ein?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  website?: string;
  vertical?: string;
  brandRelationship?: string;
};

export async function createBrandAction(payload: CreateBrandRequest) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "create10DLCBrand",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxBrand>>("/10dlc/brand", {
          method: "POST",
          body: payload,
        }),
      { tenantId, userId, requestData: { displayName: payload.displayName } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function getBrandAction(brandId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "get10DLCBrand",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxBrand>>(`/10dlc/brand/${brandId}`, {
          method: "GET",
        }),
      { tenantId, userId, requestData: { brandId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

// ─── 10DLC Campaign Actions ──────────────────────────────────────────────────

export async function listCampaignsAction() {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "list10DLCCampaigns",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxListResponse<TelnyxCampaign>>("/10dlc/campaign", {
          method: "GET",
        }),
      { tenantId, userId }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type CreateCampaignRequest = {
  brandId: string;
  usecase: string;
  description: string;
  subUsecases?: string[];
  sample1?: string;
  sample2?: string;
  messageFlow?: string;
  helpMessage?: string;
  helpKeywords?: string;
  optinKeywords?: string;
  optoutKeywords?: string;
  optinMessage?: string;
  optoutMessage?: string;
  subscriberOptin?: boolean;
  subscriberOptout?: boolean;
  subscriberHelp?: boolean;
  numberPool?: boolean;
  ageGated?: boolean;
  directLending?: boolean;
  embeddedLink?: boolean;
  embeddedPhone?: boolean;
  affiliateMarketing?: boolean;
};

export async function createCampaignAction(payload: CreateCampaignRequest) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "create10DLCCampaign",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxCampaign>>("/10dlc/campaign", {
          method: "POST",
          body: payload,
        }),
      { tenantId, userId, requestData: { brandId: payload.brandId, usecase: payload.usecase } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function getCampaignAction(campaignId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "get10DLCCampaign",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxCampaign>>(`/10dlc/campaign/${campaignId}`, {
          method: "GET",
        }),
      { tenantId, userId, requestData: { campaignId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

// ─── Phone Number ↔ Campaign Assignment ──────────────────────────────────────

export async function assignNumberToCampaignAction(
  phoneNumber: string,
  campaignId: string
) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "assignNumberTo10DLCCampaign",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxPhoneNumberCampaign>>(
          `/10dlc/campaign/${campaignId}/phoneNumber/${encodeURIComponent(phoneNumber)}`,
          { method: "PUT" }
        ),
      { tenantId, userId, requestData: { phoneNumber, campaignId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function listCampaignNumbersAction(campaignId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "list10DLCCampaignNumbers",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxListResponse<TelnyxPhoneNumberCampaign>>(
          `/10dlc/campaign/${campaignId}/phoneNumber`,
          { method: "GET" }
        ),
      { tenantId, userId, requestData: { campaignId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

// ─── Toll-Free Verification Actions ──────────────────────────────────────────

export async function listTollFreeVerificationsAction() {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "listTollFreeVerifications",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxListResponse<TelnyxTollFreeVerification>>(
          "/messaging_tollfree/verification/requests",
          { method: "GET" }
        ),
      { tenantId, userId }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type CreateTollFreeVerificationRequest = {
  businessName: string;
  corporateWebsite: string;
  businessAddr1: string;
  businessAddr2?: string;
  businessCity: string;
  businessState: string;
  businessZip: string;
  businessContactFirstName: string;
  businessContactLastName: string;
  businessContactEmail: string;
  businessContactPhone: string;
  messageVolume: string;
  phoneNumbers: Array<{ phoneNumber: string }>;
  useCase: string;
  useCaseSummary: string;
  productionMessageContent: string;
  optInWorkflow: string;
  optInWorkflowImageURLs?: Array<{ url: string }>;
  additionalInformation?: string;
  isvReseller?: string;
  webhookUrl?: string;
  businessRegistrationNumber: string;
  businessRegistrationType: string;
  businessRegistrationCountry: string;
  doingBusinessAs?: string;
  entityType?: "SOLE_PROPRIETOR" | "PRIVATE_PROFIT" | "PUBLIC_PROFIT" | "NON_PROFIT" | "GOVERNMENT";
  optInConfirmationResponse?: string;
  helpMessageResponse?: string;
  privacyPolicyURL?: string;
  termsAndConditionURL?: string;
  ageGatedContent?: boolean;
  optInKeywords?: string;
};

export async function createTollFreeVerificationAction(
  payload: CreateTollFreeVerificationRequest
) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "createTollFreeVerification",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxTollFreeVerification>>(
          "/messaging_tollfree/verification/requests",
          { method: "POST", body: payload }
        ),
      { tenantId, userId, requestData: { businessName: payload.businessName } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function getTollFreeVerificationAction(id: string) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "getTollFreeVerification",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxTollFreeVerification>>(
          `/messaging_tollfree/verification/requests/${id}`,
          { method: "GET" }
        ),
      { tenantId, userId, requestData: { id } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function deleteTollFreeVerificationAction(id: string) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "deleteTollFreeVerification",
      TELNYX_PROVIDER,
      async () =>
        transport.request<void>(
          `/messaging_tollfree/verification/requests/${id}`,
          { method: "DELETE" }
        ),
      { tenantId, userId, requestData: { id } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

// ─── Opt-Out Actions ─────────────────────────────────────────────────────────

export async function listOptOutsAction(messagingProfileId?: string) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    const params = messagingProfileId
      ? `?filter[messaging_profile_id]=${messagingProfileId}`
      : "";
    return trackApiCall(
      "listOptOuts",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxListResponse<TelnyxOptOut>>(
          `/messaging_optouts${params}`,
          { method: "GET" }
        ),
      { tenantId, userId, requestData: { messagingProfileId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}
