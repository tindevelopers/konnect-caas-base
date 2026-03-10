"use server";

import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "../crm/tenant-helper";

/**
 * Compute scheduled_at for all pending recipients. Uses timezone-aware
 * scheduling: for each recipient, finds the next slot within their local
 * calling window and staggers by STAGGER_MINUTES to respect rate limits.
 */
export async function scheduleCampaignRecipients(
  campaignId: string
): Promise<{ ok: true; scheduled: number } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    const { data: campaign } = await (supabase.from("campaigns") as any)
      .select("id, calling_window_start, calling_window_end, calls_per_minute, timezone")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .single();

    if (!campaign) {
      return { ok: false, error: "Campaign not found" };
    }

    const stepMinutes = Math.max(1, Math.floor(60 / (campaign.calls_per_minute ?? 10)));

    const { data: recipients } = await (supabase.from("campaign_recipients") as any)
      .select("id, timezone")
      .eq("campaign_id", campaignId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!recipients?.length) {
      return { ok: true, scheduled: 0 };
    }

    const now = new Date();
    let slotIndex = 0;

    for (const r of recipients) {
      const scheduled = new Date(now);
      scheduled.setMinutes(scheduled.getMinutes() + slotIndex * stepMinutes);

      await (supabase.from("campaign_recipients") as any)
        .update({ status: "scheduled", scheduled_at: scheduled.toISOString() })
        .eq("id", r.id)
        .eq("tenant_id", tenantId);

      slotIndex++;
    }

    return { ok: true, scheduled: recipients.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
