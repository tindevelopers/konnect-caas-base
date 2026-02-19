"use server";

import { headers } from "next/headers";
import { trackApiCall } from "@/src/core/telemetry";
import { createClient } from "@/core/database/server";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { getTelnyxTransport } from "./client";

const TELNYX_PROVIDER = "telnyx";

type TelnyxApiResponse<T> = { data: T; meta?: unknown; errors?: unknown };
type TelnyxListResponse<T> = { data: T[]; meta?: unknown; errors?: unknown };

export type TelnyxCallControlApplication = {
  id: string;
  record_type?: "call_control_application";
  application_name?: string | null;
  active?: boolean;
  webhook_event_url?: string | null;
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
 * List Call Control applications for the current Telnyx account (tenant or platform).
 * Used so tenants can pick a connection in-app without logging into Telnyx.
 */
export async function listCallControlApplicationsAction(): Promise<{
  data: Array<{ id: string; application_name: string | null }>;
  error?: string;
}> {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.read");
    const res = await trackApiCall(
      "listCallControlApplications",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxListResponse<TelnyxCallControlApplication>>("/call_control_applications", {
          method: "GET",
        })
    );
    const list = Array.isArray(res?.data) ? res.data : (res as { data?: { data?: TelnyxCallControlApplication[] } })?.data?.data ?? [];
    const data = list.map((app) => ({
      id: app.id,
      application_name: app.application_name ?? null,
    }));
    return { data };
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
 * Create a Call Control application with webhook URL pointing to this app.
 * Makes the product self-service: no Telnyx portal login required.
 */
export async function createCallControlApplicationAction(params: {
  application_name: string;
  webhook_event_url?: string | null;
}): Promise<{ data?: TelnyxCallControlApplication; error?: string }> {
  const { application_name } = params;
  if (!application_name?.trim()) {
    return { error: "Application name is required." };
  }

  let webhook_event_url = params.webhook_event_url?.trim() || null;
  if (!webhook_event_url) {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    if (!host) {
      return { error: "Could not determine app URL. Set webhook_event_url or deploy with a public host." };
    }
    webhook_event_url = `${proto}://${host}/api/webhooks/telnyx/call-events`;
  }

  try {
    const transport = await getTelnyxTransport("integrations.write");
    const res = await trackApiCall(
      "createCallControlApplication",
      TELNYX_PROVIDER,
      async () =>
        transport.request<TelnyxApiResponse<TelnyxCallControlApplication>>("/call_control_applications", {
          method: "POST",
          body: {
            application_name: application_name.trim(),
            webhook_event_url,
            active: true,
          },
        })
    );
    const data = (res as { data?: TelnyxCallControlApplication })?.data;
    if (!data?.id) {
      return { error: "Provider did not return a Call Control application." };
    }
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      return { error: "Provider API authentication failed. Check Telephony integration." };
    }
    if (message.includes("Tenant context missing")) {
      return { error: "Tenant context missing. Select a tenant or set platform Telephony integration." };
    }
    return { error: message };
  }
}
