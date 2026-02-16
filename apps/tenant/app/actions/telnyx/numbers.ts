"use server";

import { TelnyxApiError } from "@tinadmin/telnyx-ai-platform/server";
import { trackApiCall } from "@/src/core/telemetry";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";
import { getTelnyxTransport } from "./client";
import { OMIT_FEATURES_FOR_COUNTRIES } from "@/src/core/telnyx/country-constraints";

const TELNYX_PROVIDER = "telnyx";

type TelnyxApiResponse<T> = { data: T; meta?: unknown; errors?: unknown };
type TelnyxListResponse<T> = { data: T[]; meta?: unknown; errors?: unknown };

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

function extractTelnyxErrorDetail(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;

  if (typeof d.message === "string" && d.message.trim()) return d.message.trim();

  const errors = d.errors;
  if (Array.isArray(errors) && errors.length) {
    const parts: string[] = [];
    for (const err of errors.slice(0, 3)) {
      if (err && typeof err === "object") {
        const e = err as Record<string, unknown>;
        const title = typeof e.title === "string" ? e.title.trim() : "";
        const detail = typeof e.detail === "string" ? e.detail.trim() : "";
        const code = typeof e.code === "string" ? e.code.trim() : "";
        const part = [code && `(${code})`, title, detail].filter(Boolean).join(" ");
        if (part) parts.push(part);
      }
    }
    if (parts.length) return parts.join("; ");
  }

  if (typeof d.error === "string" && d.error.trim()) return d.error.trim();
  if (typeof d.detail === "string" && d.detail.trim()) return d.detail.trim();

  return null;
}

function enhanceTelnyxError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error(String(error));

  if (error instanceof TelnyxApiError) {
    if (error.status === 401) {
      return new Error(
        "Telnyx API authentication failed (401). Please verify your API key is valid and has the correct permissions. " +
          "Check your Telnyx API key in System Admin → Integrations → Telnyx"
      );
    }
    const detail = extractTelnyxErrorDetail(error.details);
    return new Error(detail ? `Telnyx API request failed (${error.status}): ${detail}` : `Telnyx API request failed (${error.status})`);
  }

  const msg = error.message || "";
  const lower = msg.toLowerCase();

  if (msg.includes("401") || lower.includes("unauthorized")) {
    return new Error(
      "Telnyx API authentication failed (401). Please verify your API key is valid and has the correct permissions. " +
        "Check your Telnyx API key in System Admin → Integrations → Telnyx"
    );
  }

  if (lower.includes("tenant context missing")) {
    return new Error(
      "Tenant context missing. Please select a tenant or configure the platform default Telnyx integration."
    );
  }

  return error;
}

function buildTelnyxFilterQuery(args: {
  filter?: Record<string, unknown>;
  page?: { number?: number; size?: number };
  sort?: string;
}) {
  const params = new URLSearchParams();

  if (args.sort) {
    params.set("sort", args.sort);
  }

  if (args.page?.number) params.set("page[number]", String(args.page.number));
  if (args.page?.size) params.set("page[size]", String(args.page.size));

  const filter = args.filter ?? {};
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null) continue;
    if (value === "") continue;

    if (Array.isArray(value)) {
      // Most Telnyx deepObject filters accept repeated keys.
      for (const v of value) {
        if (v === undefined || v === null) continue;
        params.append(`filter[${key}][]`, String(v));
      }
      continue;
    }

    if (typeof value === "object") {
      // Support nested deepObject ops like filter[phone_number][contains]
      for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
        if (opValue === undefined || opValue === null) continue;
        params.set(`filter[${key}][${op}]`, String(opValue));
      }
      continue;
    }

    params.set(`filter[${key}]`, String(value));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// -----------------------------
// Country coverage (for Buy Numbers dropdown)
// -----------------------------

export type TelnyxCountryCoverage = {
  code: string;
  numbers?: boolean;
  features?: string[];
  phone_number_type?: string[];
  reservable?: boolean;
  quickship?: boolean;
  region?: string | null;
};

export async function listCountryCoverageAction(): Promise<
  { ok: true; countries: { code: string; name: string }[] } | { ok: false; error: string }
> {
  const { tenantId, userId } = await getTelemetryContext();

  try {
    const transport = await getTelnyxTransport("integrations.read");

    const res = await trackApiCall(
      "listCountryCoverage",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<{ data: Record<string, TelnyxCountryCoverage> }>("/country_coverage", {
          method: "GET",
        });
      },
      { tenantId, userId, requestData: {} }
    );

    const data = res?.data ?? {};
    const countries = Object.entries(data)
      .filter(([, v]) => v?.code)
      .map(([name, v]) => ({ code: v.code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { ok: true, countries };
  } catch (e) {
    return { ok: false, error: enhanceTelnyxError(e).message };
  }
}

// -----------------------------
// Inventory coverage (available area codes / NDCs)
// -----------------------------

export type TelnyxInventoryCoverageItem = {
  record_type?: string;
  group?: string;
  group_type?: string;
  phone_number_type?: string;
  administrative_area?: string;
  count?: number;
};

type InventoryCoverageMeta = {
  total_results?: number;
  total_pages?: number;
  page_number?: number;
  page_size?: number;
};

export async function listAvailableAreaCodesAction(args: {
  countryCode: string;
  phoneNumberType?: string;
}): Promise<{ ok: true; areaCodes: string[] } | { ok: false; error: string }> {
  const { tenantId, userId } = await getTelemetryContext();

  try {
    const transport = await getTelnyxTransport("integrations.read");
    const countryCode = args.countryCode.trim().toUpperCase();
    const isUs = countryCode === "US";

    const filter: Record<string, unknown> = {
      country_code: countryCode,
      groupBy: isUs ? "npa" : "national_destination_code",
    };
    if (args.phoneNumberType?.trim()) {
      filter.phone_number_type = args.phoneNumberType.trim();
    }

    const PAGE_SIZE = 100;
    const allGroups: string[] = [];
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const path = `/inventory_coverage${buildTelnyxFilterQuery({
        filter,
        page: { number: pageNumber, size: PAGE_SIZE },
      })}`;

      const res = await trackApiCall(
        "listInventoryCoverage",
        TELNYX_PROVIDER,
        async () => {
          return transport.request<{
            data: TelnyxInventoryCoverageItem[];
            meta?: InventoryCoverageMeta;
          }>(path, { method: "GET" });
        },
        { tenantId, userId, requestData: { countryCode, phoneNumberType: args.phoneNumberType, page: pageNumber } }
      );

      const items = res?.data ?? [];
      for (const x of items) {
        if (typeof x.group === "string" && x.group.length > 0) {
          allGroups.push(x.group);
        }
      }

      const meta = res?.meta as InventoryCoverageMeta | undefined;
      const totalPages = meta?.total_pages;
      hasMore =
        items.length >= PAGE_SIZE &&
        (totalPages === undefined || pageNumber < totalPages);
      pageNumber += 1;
    }

    const areaCodes = [...new Set(allGroups)].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    return { ok: true, areaCodes };
  } catch (e) {
    return { ok: false, error: enhanceTelnyxError(e).message };
  }
}

// -----------------------------
// Inventory coverage (available localities / cities)
// -----------------------------

export async function listAvailableLocalitiesAction(args: {
  countryCode: string;
  phoneNumberType?: string;
}): Promise<{ ok: true; localities: string[] } | { ok: false; error: string }> {
  const { tenantId, userId } = await getTelemetryContext();

  try {
    const transport = await getTelnyxTransport("integrations.read");
    const countryCode = args.countryCode.trim().toUpperCase();

    const filter: Record<string, unknown> = {
      country_code: countryCode,
      groupBy: "locality",
    };
    if (args.phoneNumberType?.trim()) {
      filter.phone_number_type = args.phoneNumberType.trim();
    }

    const PAGE_SIZE = 100;
    const allGroups: string[] = [];
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const path = `/inventory_coverage${buildTelnyxFilterQuery({
        filter,
        page: { number: pageNumber, size: PAGE_SIZE },
      })}`;

      const res = await trackApiCall(
        "listInventoryCoverageLocalities",
        TELNYX_PROVIDER,
        async () => {
          return transport.request<{
            data: TelnyxInventoryCoverageItem[];
            meta?: InventoryCoverageMeta;
          }>(path, { method: "GET" });
        },
        { tenantId, userId, requestData: { countryCode, phoneNumberType: args.phoneNumberType, page: pageNumber } }
      );

      const items = res?.data ?? [];
      for (const x of items) {
        if (typeof x.group === "string" && x.group.length > 0) {
          allGroups.push(x.group);
        }
      }

      const meta = res?.meta as InventoryCoverageMeta | undefined;
      const totalPages = meta?.total_pages;
      hasMore =
        items.length >= PAGE_SIZE &&
        (totalPages === undefined || pageNumber < totalPages);
      pageNumber += 1;
    }

    const localities = [...new Set(allGroups)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    return { ok: true, localities };
  } catch (e) {
    return { ok: false, error: enhanceTelnyxError(e).message };
  }
}

// Database-backed locality prefix search (chi -> Chicago, etc.)
export async function searchLocalitiesFromDbAction(args: {
  countryCode: string;
  localityQuery: string;
  phoneNumberType?: string;
}): Promise<{ ok: true; localities: string[] } | { ok: false; error: string }> {
  const q = args.localityQuery?.trim();
  if (!q || q.length < 2) return { ok: true, localities: [] };

  try {
    // Use admin client: telnyx_localities is platform-wide reference data, no tenant/session required
    const supabase = createAdminClient();
    const countryCode = args.countryCode.trim().toUpperCase();
    const phoneNumberType = args.phoneNumberType?.trim() || "local";
    const prefix = q.replace(/%/g, "\\%").replace(/_/g, "\\_");

    // Try requested type first; fall back to "local" for types we may not have (mobile, national).
    // UK/Europe: national and local often share localities; toll_free is country-wide.
    const typesToTry = [phoneNumberType];
    if (!["local", "toll_free"].includes(phoneNumberType)) {
      typesToTry.push("local");
    }

    const { data, error } = await supabase
      .from("telnyx_localities")
      .select("locality")
      .eq("country_code", countryCode)
      .eq("source", "telnyx")
      .in("phone_number_type", typesToTry)
      .ilike("locality", `${prefix}%`)
      .order("locality")
      .limit(25);

    if (error) return { ok: false, error: error.message };

    const localities = [...new Set((data ?? []).map((r) => r.locality).filter(Boolean))];
    return { ok: true, localities };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// Search-based locality suggestions (fallback when DB has no match - uses Telnyx exact search)
export async function searchLocalitySuggestionsAction(args: {
  countryCode: string;
  localityQuery: string;
  phoneNumberType?: string;
}): Promise<{ ok: true; localities: string[] } | { ok: false; error: string }> {
  const q = args.localityQuery?.trim();
  if (!q || q.length < 2) return { ok: true, localities: [] };

  try {
    const localityForSearch = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase();
    const res = await searchAvailablePhoneNumbersAction({
      countryCode: args.countryCode.trim().toUpperCase(),
      phoneNumberType: args.phoneNumberType?.trim() || undefined,
      locality: localityForSearch,
      limit: 25,
      reservable: false,
    });

    const data = res?.data ?? [];
    const seen = new Set<string>();
    const localities: string[] = [];

    for (const item of data) {
      const regions = item.region_information ?? [];
      for (const r of regions) {
        const name = r.region_name?.trim();
        if (!name) continue;
        const type = (r.region_type ?? "").toLowerCase();
        if (type === "locality" || type === "location" || type === "rate_center") {
          if (!seen.has(name)) {
            seen.add(name);
            localities.push(name);
          }
        }
      }
    }

    return { ok: true, localities: localities.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })) };
  } catch (e) {
    return { ok: false, error: enhanceTelnyxError(e).message };
  }
}

// -----------------------------
// Numbers: search + reservations + orders
// -----------------------------

export type TelnyxAvailablePhoneNumber = {
  record_type: "available_phone_number";
  phone_number: string;
  vanity_format?: string;
  best_effort?: boolean;
  quickship?: boolean;
  reservable?: boolean;
  region_information?: Array<{ region_type: string; region_name: string }>;
  cost_information?: { upfront_cost?: string; monthly_cost?: string; currency?: string };
  features?: Array<{ name: string }>;
};

export type PhoneNumberPattern = "contains" | "starts_with" | "ends_with";

export async function searchAvailablePhoneNumbersAction(args: {
  countryCode: string;
  phoneNumberType?: string;
  locality?: string;
  administrativeArea?: string;
  rateCenter?: string;
  phoneNumber?: string;
  phoneNumberPattern?: PhoneNumberPattern;
  nationalDestinationCode?: string;
  features?: string[];
  limit?: number;
  bestEffort?: boolean;
  quickship?: boolean;
  reservable?: boolean;
  excludeHeldNumbers?: boolean;
}) {
  const { tenantId, userId } = await getTelemetryContext();

  try {
    const transport = await getTelnyxTransport("integrations.read");

    const countryCode = args.countryCode.trim().toUpperCase();
    const isUsOrCanada = ["US", "CA"].includes(countryCode);

    const filter: Record<string, unknown> = {
      country_code: countryCode,
      ...(args.phoneNumberType?.trim() && { phone_number_type: args.phoneNumberType.trim() }),
      ...(args.locality?.trim() && { locality: args.locality.trim() }),
      ...(args.administrativeArea?.trim() && { administrative_area: args.administrativeArea.trim() }),
      ...(args.nationalDestinationCode?.trim() && { national_destination_code: args.nationalDestinationCode.trim() }),
      limit: args.limit ?? 50,
      ...(isUsOrCanada && args.reservable !== undefined && { reservable: args.reservable }),
      ...(args.excludeHeldNumbers !== undefined && args.excludeHeldNumbers && { exclude_held_numbers: true }),
    };

    // Available numbers search supports deep-object operators for phone_number matching.
    const pattern = args.phoneNumberPattern ?? "contains";
    if (args.phoneNumber?.trim()) {
      filter.phone_number = { [pattern]: args.phoneNumber.trim() };
    }

    // rate_center, best_effort, quickship are only applicable to US/Canada
    if (isUsOrCanada) {
      filter.rate_center = args.rateCenter;
      filter.best_effort = args.bestEffort;
      filter.quickship = args.quickship;
    }

    // The API expects an array; send as repeated `filter[features][]` keys.
    let features = args.features?.length ? [...args.features] : undefined;
    if (OMIT_FEATURES_FOR_COUNTRIES.has(countryCode)) {
      features = undefined;
    }
    if (features?.length) filter.features = features;

    const path = `/available_phone_numbers${buildTelnyxFilterQuery({ filter })}`;

    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/c141a6d2-6ba1-4f5d-8816-b3fe0f95fe23", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "numbers.ts:searchAvailablePhoneNumbersAction",
        message: "Telnyx search request",
        data: { countryCode, path, filter: JSON.stringify(filter) },
        timestamp: Date.now(),
        hypothesisId: "H1",
      }),
    }).catch(() => {});
    // #endregion

    return trackApiCall(
      "searchAvailablePhoneNumbers",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxListResponse<TelnyxAvailablePhoneNumber>>(path, {
          method: "GET",
        });
      },
      {
        tenantId,
        userId,
        requestData: {
          countryCode,
          phoneNumberType: args.phoneNumberType,
          featuresCount: features?.length ?? 0,
        },
      }
    );
  } catch (e) {
    // #region agent log
    const errDetails =
      e && typeof e === "object" && "details" in e
        ? (e as { details?: unknown }).details
        : e instanceof Error
          ? { message: e.message }
          : String(e);
    fetch("http://127.0.0.1:7244/ingest/c141a6d2-6ba1-4f5d-8816-b3fe0f95fe23", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "numbers.ts:searchAvailablePhoneNumbersAction:catch",
        message: "Telnyx search error",
        data: { errorDetails: errDetails },
        timestamp: Date.now(),
        hypothesisId: "H2",
      }),
    }).catch(() => {});
    // #endregion
    throw enhanceTelnyxError(e);
  }
}

export type TelnyxReservedPhoneNumber = {
  id: string;
  record_type: "reserved_phone_number";
  phone_number: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  expired_at?: string;
  errors?: string;
};

export type TelnyxNumberReservation = {
  id: string;
  record_type: "number_reservation";
  phone_numbers: TelnyxReservedPhoneNumber[];
  status?: string;
  customer_reference?: string;
  created_at?: string;
  updated_at?: string;
};

export async function createNumberReservationAction(args: {
  phoneNumbers: string[];
  customerReference?: string;
}) {
  const { tenantId, userId } = await getTelemetryContext();

  if (!args.phoneNumbers?.length) {
    throw new Error("At least one phone number is required to reserve.");
  }

  try {
    const transport = await getTelnyxTransport("integrations.write");
    const body = {
      phone_numbers: args.phoneNumbers.map((phone_number) => ({ phone_number })),
      customer_reference: args.customerReference?.trim() || undefined,
    };

    return trackApiCall(
      "createNumberReservation",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxNumberReservation>>("/number_reservations", {
          method: "POST",
          body,
        });
      },
      {
        tenantId,
        userId,
        requestData: { phoneNumbersCount: args.phoneNumbers.length, hasCustomerReference: !!args.customerReference },
      }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function extendNumberReservationAction(reservationId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!reservationId?.trim()) throw new Error("reservationId is required");

  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "extendNumberReservation",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxNumberReservation>>(
          `/number_reservations/${reservationId}/actions/extend`,
          { method: "POST", body: {} }
        );
      },
      { tenantId, userId, requestData: { reservationId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function retrieveNumberReservationAction(reservationId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!reservationId?.trim()) throw new Error("reservationId is required");

  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "retrieveNumberReservation",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxNumberReservation>>(
          `/number_reservations/${reservationId}`,
          { method: "GET" }
        );
      },
      { tenantId, userId, requestData: { reservationId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function deleteNumberReservationAction(reservationId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!reservationId?.trim()) throw new Error("reservationId is required");

  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "deleteNumberReservation",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxNumberReservation>>(
          `/number_reservations/${reservationId}`,
          { method: "DELETE" }
        );
      },
      { tenantId, userId, requestData: { reservationId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function listNumberReservationsAction(args?: { pageNumber?: number; pageSize?: number }) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    const qs = buildTelnyxFilterQuery({
      "page[number]": args?.pageNumber ?? 1,
      "page[size]": args?.pageSize ?? 25,
    });
    return trackApiCall(
      "listNumberReservations",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxNumberReservation[]>>(`/number_reservations?${qs}`, {
          method: "GET",
        });
      },
      { tenantId, userId, requestData: args }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type TelnyxNumberOrderPhoneNumber = {
  id?: string;
  record_type?: string;
  phone_number: string;
  status?: string;
  requirements_met?: boolean;
};

export type TelnyxNumberOrder = {
  id: string;
  record_type: "number_order";
  status?: string;
  phone_numbers_count?: number;
  connection_id?: string | null;
  messaging_profile_id?: string | null;
  billing_group_id?: string | null;
  customer_reference?: string | null;
  requirements_met?: boolean;
  created_at?: string;
  updated_at?: string;
  phone_numbers?: TelnyxNumberOrderPhoneNumber[];
};

export async function listNumberOrdersAction(args?: { pageNumber?: number; pageSize?: number }) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    const qs = buildTelnyxFilterQuery({
      page: { number: args?.pageNumber ?? 1, size: args?.pageSize ?? 25 },
    });

    return trackApiCall(
      "listNumberOrders",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxListResponse<TelnyxNumberOrder>>(`/number_orders${qs}`, {
          method: "GET",
        });
      },
      { tenantId, userId, requestData: { pageNumber: args?.pageNumber ?? 1, pageSize: args?.pageSize ?? 25 } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function retrieveNumberOrderAction(orderId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!orderId?.trim()) throw new Error("orderId is required");

  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "retrieveNumberOrder",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxNumberOrder>>(`/number_orders/${orderId}`, {
          method: "GET",
        });
      },
      { tenantId, userId, requestData: { orderId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function createNumberOrderAction(args: {
  phoneNumbers: string[];
  connectionId?: string;
  messagingProfileId?: string;
  billingGroupId?: string;
  customerReference?: string;
  requirementGroupId?: string;
  /** Optional cost info from search results for billing/markup tracking */
  costInfo?: {
    upfrontCost?: number;
    monthlyCost?: number;
    currency?: string;
  };
  /** If true, bypass reservation and order directly (use when reservation expired) */
  bypassReservation?: boolean;
}) {
  const { tenantId, userId } = await getTelemetryContext();

  if (!args.phoneNumbers?.length) {
    throw new Error("At least one phone number is required to create an order.");
  }

  try {
    const transport = await getTelnyxTransport("integrations.write");
    const reqGroupId = args.requirementGroupId?.trim();
    const body: Record<string, unknown> = {
      phone_numbers: args.phoneNumbers.map((phone_number) => {
        const entry: Record<string, string> = { phone_number };
        if (reqGroupId) entry.requirement_group_id = reqGroupId;
        return entry;
      }),
    };
    if (args.connectionId?.trim()) body.connection_id = args.connectionId.trim();
    if (args.messagingProfileId?.trim()) body.messaging_profile_id = args.messagingProfileId.trim();
    if (args.billingGroupId?.trim()) body.billing_group_id = args.billingGroupId.trim();
    if (args.customerReference?.trim()) body.customer_reference = args.customerReference.trim();

    const result = await trackApiCall(
      "createNumberOrder",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxNumberOrder>>("/number_orders", {
          method: "POST",
          body,
        });
      },
      {
        tenantId,
        userId,
        requestData: {
          phoneNumbersCount: args.phoneNumbers.length,
          hasConnectionId: Boolean(args.connectionId),
          hasMessagingProfileId: Boolean(args.messagingProfileId),
          hasBillingGroupId: Boolean(args.billingGroupId),
        },
      }
    );

    // Record costs for billing (best-effort, non-blocking)
    if (tenantId && result?.data?.id) {
      const orderId = result.data.id;
      const currency = args.costInfo?.currency ?? "USD";
      const numCount = args.phoneNumbers.length;

      void recordNumberOrderCosts({
        tenantId,
        orderId,
        upfrontCost: (args.costInfo?.upfrontCost ?? 0) * numCount,
        monthlyCost: (args.costInfo?.monthlyCost ?? 0) * numCount,
        currency,
        phoneNumbers: args.phoneNumbers,
      });
    }

    return result;
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

/**
 * Record number order costs in tenant_usage_costs (fire-and-forget).
 */
async function recordNumberOrderCosts(args: {
  tenantId: string;
  orderId: string;
  upfrontCost: number;
  monthlyCost: number;
  currency: string;
  phoneNumbers: string[];
}) {
  try {
    // Dynamic import to avoid circular deps
    const { recordCostAndBillAction } = await import("@/app/actions/billing/usage-costs");

    if (args.upfrontCost > 0) {
      await recordCostAndBillAction({
        tenantId: args.tenantId,
        costType: "number_upfront",
        costAmount: args.upfrontCost,
        units: args.phoneNumbers.length,
        currency: args.currency,
        sourceId: args.orderId,
        sourceType: "telnyx_number_order",
        metadata: {
          phone_numbers: args.phoneNumbers,
          upfront_cost: args.upfrontCost,
        },
      });
    }

    if (args.monthlyCost > 0) {
      await recordCostAndBillAction({
        tenantId: args.tenantId,
        costType: "number_monthly",
        costAmount: args.monthlyCost,
        units: args.phoneNumbers.length,
        currency: args.currency,
        sourceId: args.orderId,
        sourceType: "telnyx_number_order",
        metadata: {
          phone_numbers: args.phoneNumbers,
          monthly_cost: args.monthlyCost,
        },
      });
    }
  } catch (error) {
    console.error("[recordNumberOrderCosts] Error recording costs (non-fatal):", error);
  }
}

// -----------------------------
// Phone Numbers (owned inventory)
// -----------------------------

export type TelnyxPhoneNumber = {
  id: string;
  record_type: "phone_number";
  phone_number: string;
  status?: string;
  country_iso_alpha2?: string;
  phone_number_type?: string;
  tags?: string[];
  customer_reference?: string | null;
  connection_id?: string | null;
  connection_name?: string | null;
  messaging_profile_id?: string | null;
  messaging_profile_name?: string | null;
  billing_group_id?: string | null;
  emergency_enabled?: boolean;
  deletion_lock_enabled?: boolean;
  purchased_at?: string;
  created_at?: string;
  updated_at?: string;
};

export async function listOwnedPhoneNumbersAction(args?: {
  phoneNumberContains?: string;
  status?: string;
  countryIsoAlpha2?: string;
  connectionId?: string;
  billingGroupId?: string;
  tag?: string;
  sort?: string;
  pageNumber?: number;
  pageSize?: number;
  handleMessagingProfileError?: boolean;
}) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");

    const filter: Record<string, unknown> = {};
    if (args?.phoneNumberContains?.trim()) {
      filter.phone_number = { contains: args.phoneNumberContains.trim() };
    }
    if (args?.status?.trim()) filter.status = args.status.trim();
    if (args?.countryIsoAlpha2?.trim()) filter.country_iso_alpha2 = args.countryIsoAlpha2.trim().toUpperCase();
    if (args?.connectionId?.trim()) filter.connection_id = args.connectionId.trim();
    if (args?.billingGroupId?.trim()) filter.billing_group_id = args.billingGroupId.trim();
    if (args?.tag?.trim()) filter.tag = args.tag.trim();

    const qs = buildTelnyxFilterQuery({
      filter,
      page: { number: args?.pageNumber ?? 1, size: args?.pageSize ?? 25 },
      sort: args?.sort,
    });

    const path = `/phone_numbers${qs}${
      typeof args?.handleMessagingProfileError === "boolean"
        ? `${qs ? "&" : "?"}handle_messaging_profile_error=${String(args.handleMessagingProfileError)}`
        : ""
    }`;

    return trackApiCall(
      "listOwnedPhoneNumbers",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxListResponse<TelnyxPhoneNumber>>(path, { method: "GET" });
      },
      {
        tenantId,
        userId,
        requestData: {
          hasPhoneNumberContains: Boolean(args?.phoneNumberContains),
          status: args?.status,
          countryIsoAlpha2: args?.countryIsoAlpha2,
        },
      }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function retrieveOwnedPhoneNumberAction(phoneNumberId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!phoneNumberId?.trim()) throw new Error("phoneNumberId is required");

  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "retrieveOwnedPhoneNumber",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxPhoneNumber>>(`/phone_numbers/${phoneNumberId}`, {
          method: "GET",
        });
      },
      { tenantId, userId, requestData: { phoneNumberId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type UpdateOwnedPhoneNumberPatch = Partial<
  Pick<
    TelnyxPhoneNumber,
    | "connection_id"
    | "billing_group_id"
    | "customer_reference"
    | "tags"
    | "deletion_lock_enabled"
    | "emergency_enabled"
  >
>;

export async function updateOwnedPhoneNumberAction(phoneNumberId: string, patch: UpdateOwnedPhoneNumberPatch) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!phoneNumberId?.trim()) throw new Error("phoneNumberId is required");

  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "updateOwnedPhoneNumber",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<TelnyxPhoneNumber>>(`/phone_numbers/${phoneNumberId}`, {
          method: "PATCH",
          body: patch,
        });
      },
      { tenantId, userId, requestData: { phoneNumberId, patchKeys: Object.keys(patch ?? {}) } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

// -----------------------------
// Porting Orders
// -----------------------------

export type TelnyxPortingOrderStatus = { value?: string; details?: Array<{ code?: string; description?: string }> };

export type TelnyxPortingOrder = {
  id: string;
  record_type?: "porting_order";
  customer_reference?: string | null;
  customer_group_reference?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: TelnyxPortingOrderStatus;
  support_key?: string | null;
  parent_support_key?: string | null;
  porting_phone_numbers_count?: number;
  phone_number_type?: string;
  old_service_provider_ocn?: string | null;
  webhook_url?: string | null;
  requirements_met?: boolean;
};

export async function listPortingOrdersAction(args?: { pageNumber?: number; pageSize?: number }) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    const qs = buildTelnyxFilterQuery({
      page: { number: args?.pageNumber ?? 1, size: args?.pageSize ?? 25 },
    });

    return trackApiCall(
      "listPortingOrders",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxListResponse<TelnyxPortingOrder>>(`/porting_orders${qs}`, {
          method: "GET",
        });
      },
      { tenantId, userId, requestData: { pageNumber: args?.pageNumber ?? 1, pageSize: args?.pageSize ?? 25 } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function retrievePortingOrderAction(portingOrderId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!portingOrderId?.trim()) throw new Error("portingOrderId is required");

  try {
    const transport = await getTelnyxTransport("integrations.read");
    return trackApiCall(
      "retrievePortingOrder",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<Record<string, unknown>>>(`/porting_orders/${portingOrderId}`, {
          method: "GET",
        });
      },
      { tenantId, userId, requestData: { portingOrderId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function createPortingOrderAction(args: {
  phoneNumbers: string[];
  customerReference?: string;
}) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!args.phoneNumbers?.length) throw new Error("At least one phone number is required to create a porting order.");

  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "createPortingOrder",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<Record<string, unknown>>>("/porting_orders", {
          method: "POST",
          body: {
            phone_numbers: args.phoneNumbers,
            customer_reference: args.customerReference?.trim() || undefined,
          },
        });
      },
      { tenantId, userId, requestData: { phoneNumbersCount: args.phoneNumbers.length } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function updatePortingOrderAction(portingOrderId: string, patch: Record<string, unknown>) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!portingOrderId?.trim()) throw new Error("portingOrderId is required");

  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "updatePortingOrder",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<Record<string, unknown>>>(`/porting_orders/${portingOrderId}`, {
          method: "PATCH",
          body: patch,
        });
      },
      { tenantId, userId, requestData: { portingOrderId, patchKeys: Object.keys(patch ?? {}) } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function confirmPortingOrderAction(portingOrderId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!portingOrderId?.trim()) throw new Error("portingOrderId is required");

  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "confirmPortingOrder",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxApiResponse<Record<string, unknown>>>(
          `/porting_orders/${portingOrderId}/actions/confirm`,
          { method: "POST", body: {} }
        );
      },
      { tenantId, userId, requestData: { portingOrderId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

// -----------------------------
// Compliance: requirements + requirement groups
// -----------------------------

export type TelnyxRequirementType = {
  id: string;
  record_type: "requirement_type";
  name?: string;
  description?: string;
  type?: string;
  example?: string;
};

export type TelnyxRequirement = {
  id: string;
  record_type: "requirement";
  country_code?: string;
  locality?: string;
  phone_number_type?: string;
  action?: string;
  requirements_types?: TelnyxRequirementType[];
  created_at?: string;
  updated_at?: string;
};

export async function listRequirementsAction(args?: {
  pageNumber?: number;
  pageSize?: number;
  sort?: string;
}) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    const qs = buildTelnyxFilterQuery({
      page: { number: args?.pageNumber ?? 1, size: args?.pageSize ?? 25 },
      sort: args?.sort,
    });

    return trackApiCall(
      "listRequirements",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxListResponse<TelnyxRequirement>>(`/requirements${qs}`, { method: "GET" });
      },
      { tenantId, userId, requestData: { pageNumber: args?.pageNumber ?? 1, pageSize: args?.pageSize ?? 25 } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export type TelnyxRequirementGroup = {
  id: string;
  record_type?: "requirement_group";
  country_code: string;
  phone_number_type: string;
  action: "ordering" | "porting" | string;
  status?: string;
  customer_reference?: string | null;
  created_at?: string;
  updated_at?: string;
  regulatory_requirements?: Array<{
    requirement_id?: string;
    field_value?: string;
    field_type?: string;
    status?: string;
    expires_at?: string;
    created_at?: string;
    updated_at?: string;
  }>;
};

export async function listRequirementGroupsAction(args?: {
  pageNumber?: number;
  pageSize?: number;
}) {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    const qs = buildTelnyxFilterQuery({
      page: { number: args?.pageNumber ?? 1, size: args?.pageSize ?? 25 },
    });

    return trackApiCall(
      "listRequirementGroups",
      TELNYX_PROVIDER,
      async () => {
        // Some Telnyx list endpoints return `{ data, meta }`, others return a raw array.
        const res = await transport.request<unknown>(`/requirement_groups${qs}`, { method: "GET" });
        if (Array.isArray(res)) {
          return { data: res as TelnyxRequirementGroup[] } satisfies TelnyxListResponse<TelnyxRequirementGroup>;
        }
        return res as TelnyxListResponse<TelnyxRequirementGroup>;
      },
      { tenantId, userId, requestData: { pageNumber: args?.pageNumber ?? 1, pageSize: args?.pageSize ?? 25 } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function createRequirementGroupAction(args: {
  countryCode: string;
  phoneNumberType: "local" | "toll_free" | "mobile" | "national" | "shared_cost";
  action: "ordering" | "porting";
  customerReference?: string;
}) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!args.countryCode?.trim()) throw new Error("countryCode is required");

  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "createRequirementGroup",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxRequirementGroup>("/requirement_groups", {
          method: "POST",
          body: {
            country_code: args.countryCode.trim().toUpperCase(),
            phone_number_type: args.phoneNumberType,
            action: args.action,
            customer_reference: args.customerReference?.trim() || undefined,
          },
        });
      },
      {
        tenantId,
        userId,
        requestData: { countryCode: args.countryCode, phoneNumberType: args.phoneNumberType, action: args.action },
      }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function submitRequirementGroupForApprovalAction(requirementGroupId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!requirementGroupId?.trim()) throw new Error("requirementGroupId is required");

  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "submitRequirementGroupForApproval",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxRequirementGroup>(
          `/requirement_groups/${requirementGroupId}/submit_for_approval`,
          { method: "POST", body: {} }
        );
      },
      { tenantId, userId, requestData: { requirementGroupId } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

export async function updateRequirementGroupValuesAction(
  requirementGroupId: string,
  patch: Record<string, unknown>
) {
  const { tenantId, userId } = await getTelemetryContext();
  if (!requirementGroupId?.trim()) throw new Error("requirementGroupId is required");

  try {
    const transport = await getTelnyxTransport("integrations.write");
    return trackApiCall(
      "updateRequirementGroupValues",
      TELNYX_PROVIDER,
      async () => {
        return transport.request<TelnyxRequirementGroup>(`/requirement_groups/${requirementGroupId}`, {
          method: "PATCH",
          body: patch,
        });
      },
      { tenantId, userId, requestData: { requirementGroupId, patchKeys: Object.keys(patch ?? {}) } }
    );
  } catch (e) {
    throw enhanceTelnyxError(e);
  }
}

