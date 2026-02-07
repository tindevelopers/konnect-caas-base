"use server";

import { createAdminClient } from "@/core/database/admin-client";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { isPlatformAdmin } from "@/core/database/organization-admins";

export interface TelephonyEvent {
  id: string;
  tenant_id: string;
  provider: string;
  event_type: string;
  external_id: string | null;
  payload: Record<string, unknown>;
  received_at: string;
}

export interface AiAgentEvent {
  id: string;
  tenant_id: string;
  provider: string;
  event_type: string;
  external_id: string | null;
  payload: Record<string, unknown>;
  received_at: string;
}

interface WebhookEventsResult {
  telephony: TelephonyEvent[];
  aiAgent: AiAgentEvent[];
}

/**
 * Fetch recent webhook events for the current tenant
 * Platform Admins can view all events
 */
export async function getWebhookEventsAction(
  options?: {
    limit?: number;
    provider?: string;
    eventType?: string;
  }
): Promise<WebhookEventsResult> {
  const limit = options?.limit ?? 50;
  const provider = options?.provider ?? "telnyx";
  const isAdmin = await isPlatformAdmin();

  let tenantId: string | null = null;
  if (!isAdmin) {
    try {
      tenantId = await ensureTenantId();
    } catch {
      throw new Error("Tenant context required to view webhook events");
    }
  }

  const adminClient = createAdminClient();

  // Build telephony events query
  let telephonyQuery = adminClient
    .from("telephony_events")
    .select("*")
    .eq("provider", provider)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (tenantId) {
    telephonyQuery = telephonyQuery.eq("tenant_id", tenantId);
  }

  if (options?.eventType) {
    telephonyQuery = telephonyQuery.eq("event_type", options.eventType);
  }

  const { data: telephonyData, error: telephonyError } = await telephonyQuery;

  if (telephonyError) {
    console.error("Error fetching telephony events:", telephonyError);
    throw new Error("Failed to fetch telephony events");
  }

  // Build AI agent events query
  let aiAgentQuery = adminClient
    .from("ai_agent_events")
    .select("*")
    .eq("provider", provider)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (tenantId) {
    aiAgentQuery = aiAgentQuery.eq("tenant_id", tenantId);
  }

  if (options?.eventType) {
    aiAgentQuery = aiAgentQuery.eq("event_type", options.eventType);
  }

  const { data: aiAgentData, error: aiAgentError } = await aiAgentQuery;

  if (aiAgentError) {
    console.error("Error fetching AI agent events:", aiAgentError);
    throw new Error("Failed to fetch AI agent events");
  }

  return {
    telephony: (telephonyData as TelephonyEvent[]) ?? [],
    aiAgent: (aiAgentData as AiAgentEvent[]) ?? [],
  };
}

/**
 * Get webhook event statistics
 */
export async function getWebhookStatsAction() {
  const isAdmin = await isPlatformAdmin();

  let tenantId: string | null = null;
  if (!isAdmin) {
    try {
      tenantId = await ensureTenantId();
    } catch {
      throw new Error("Tenant context required to view webhook stats");
    }
  }

  const adminClient = createAdminClient();

  // Count telephony events
  let telephonyCountQuery = adminClient
    .from("telephony_events")
    .select("id", { count: "exact", head: true })
    .eq("provider", "telnyx");

  if (tenantId) {
    telephonyCountQuery = telephonyCountQuery.eq("tenant_id", tenantId);
  }

  const { count: telephonyCount, error: telephonyError } = await telephonyCountQuery;

  if (telephonyError) {
    console.error("Error counting telephony events:", telephonyError);
  }

  // Count AI agent events
  let aiAgentCountQuery = adminClient
    .from("ai_agent_events")
    .select("id", { count: "exact", head: true })
    .eq("provider", "telnyx");

  if (tenantId) {
    aiAgentCountQuery = aiAgentCountQuery.eq("tenant_id", tenantId);
  }

  const { count: aiAgentCount, error: aiAgentError } = await aiAgentCountQuery;

  if (aiAgentError) {
    console.error("Error counting AI agent events:", aiAgentError);
  }

  return {
    telephonyCount: telephonyCount ?? 0,
    aiAgentCount: aiAgentCount ?? 0,
  };
}
