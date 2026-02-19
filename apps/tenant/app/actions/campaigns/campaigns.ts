"use server";

import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "../crm/tenant-helper";
import { processCampaignVoiceBatch } from "./executor";

export type CampaignType = "voice" | "sms" | "whatsapp" | "multi_channel";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export type Campaign = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  campaign_type: CampaignType;
  assistant_id: string | null;
  from_number: string | null;
  message_template: string | null;
  schedule_start: string | null;
  schedule_end: string | null;
  calling_window_start: string;
  calling_window_end: string;
  calling_days: number[];
  max_attempts: number;
  retry_delay_minutes: number;
  max_concurrent_calls: number;
  calls_per_minute: number;
  settings: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignInsert = Omit<
  Campaign,
  "id" | "tenant_id" | "created_at" | "updated_at"
> & {
  tenant_id?: string;
};

export type CampaignStats = {
  total: number;
  pending: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  failed: number;
  skipped: number;
  opted_out: number;
  no_answer: number;
  voicemail: number;
};

export async function getCampaigns(): Promise<Campaign[]> {
  const tenantId = await getTenantForCrm();
  const supabase = await createClient();
  const { data, error } = await (supabase.from("campaigns") as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as Campaign[]) ?? [];
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const tenantId = await getTenantForCrm();
  const supabase = await createClient();
  const { data, error } = await (supabase.from("campaigns") as any)
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Campaign;
}

export async function createCampaign(
  input: Partial<CampaignInsert>
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    const row = {
      tenant_id: tenantId,
      name: input.name ?? "Untitled Campaign",
      description: input.description ?? null,
      status: input.status ?? "draft",
      campaign_type: input.campaign_type ?? "voice",
      assistant_id: input.assistant_id ?? null,
      from_number: input.from_number ?? null,
      message_template: input.message_template ?? null,
      schedule_start: input.schedule_start ?? null,
      schedule_end: input.schedule_end ?? null,
      calling_window_start: input.calling_window_start ?? "09:00",
      calling_window_end: input.calling_window_end ?? "20:00",
      calling_days: input.calling_days ?? [1, 2, 3, 4, 5],
      max_attempts: input.max_attempts ?? 3,
      retry_delay_minutes: input.retry_delay_minutes ?? 60,
      max_concurrent_calls: input.max_concurrent_calls ?? 5,
      calls_per_minute: input.calls_per_minute ?? 10,
      settings: input.settings ?? {},
    };

    const { data, error } = await (supabase.from("campaigns") as any)
      .insert(row)
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function updateCampaign(
  id: string,
  updates: Partial<CampaignInsert>
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    const { error } = await (supabase.from("campaigns") as any)
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function deleteCampaign(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { error } = await (supabase.from("campaigns") as any)
      .update({ deleted_at: now, status: "cancelled" })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function getCampaignStats(
  campaignId: string
): Promise<CampaignStats | null> {
  const tenantId = await getTenantForCrm();
  const supabase = await createClient();

  const { data, error } = await (supabase.from("campaign_recipients") as any)
    .select("status")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", tenantId);

  if (error) return null;

  const stats: CampaignStats = {
    total: 0,
    pending: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    opted_out: 0,
    no_answer: 0,
    voicemail: 0,
  };

  for (const row of (data ?? []) as { status: string }[]) {
    stats.total++;
    const s = row.status as keyof CampaignStats;
    if (s in stats && typeof stats[s] === "number") {
      (stats[s] as number)++;
    }
  }
  return stats;
}

export type CampaignRecipient = {
  id: string;
  campaign_id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
  timezone: string;
  client_type: string | null;
  status: string;
  scheduled_at: string | null;
  attempts: number;
  completed_at: string | null;
  created_at: string;
};

export async function getCampaignRecipients(
  campaignId: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<CampaignRecipient[]> {
  const tenantId = await getTenantForCrm();
  const supabase = await createClient();
  let q = (supabase.from("campaign_recipients") as any)
    .select("id, campaign_id, first_name, last_name, phone, email, timezone, client_type, status, scheduled_at, attempts, completed_at, created_at")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    q = q.eq("status", options.status);
  }
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) throw error;
  return (data as CampaignRecipient[]) ?? [];
}

export async function getCampaignRecipientsForExport(
  campaignId: string
): Promise<CampaignRecipient[]> {
  return getCampaignRecipients(campaignId, { limit: 10000 });
}

export async function getRecipientTimezoneStats(
  campaignId: string
): Promise<Record<string, number>> {
  const tenantId = await getTenantForCrm();
  const supabase = await createClient();
  const { data } = await (supabase.from("campaign_recipients") as any)
    .select("timezone")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", tenantId);

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { timezone: string }[]) {
    const tz = row.timezone || "Unknown";
    counts[tz] = (counts[tz] ?? 0) + 1;
  }
  return counts;
}

/**
 * Run one batch of campaign calls for the current tenant (for "Process now" / testing).
 * In production, the cron job at /api/campaigns/process runs every 2 minutes.
 */
export async function processCampaignBatchNow(): Promise<
  { ok: true; processed: number; errors: string[] } | { ok: false; error: string }
> {
  try {
    const tenantId = await getTenantForCrm();
    const result = await processCampaignVoiceBatch(tenantId);
    return { ok: true, processed: result.processed, errors: result.errors };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
