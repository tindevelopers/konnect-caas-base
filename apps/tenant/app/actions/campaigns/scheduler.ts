"use server";

import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "../crm/tenant-helper";
import { nextAllowedStartUtc } from "@/src/core/campaigns/scheduling";

/**
 * Compute scheduled_at for all pending recipients. Uses timezone-aware
 * scheduling: for each recipient, finds the next slot within their local
 * calling window and staggers by a campaign-defined interval.
 */
export async function scheduleCampaignRecipients(
  campaignId: string
): Promise<{ ok: true; scheduled: number } | { ok: false; error: string }> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();

    const { data: campaign } = await (supabase.from("campaigns") as any)
      .select(
        "id, calling_window_start, calling_window_end, calling_days, calls_per_minute, timezone, settings"
      )
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .single();

    if (!campaign) {
      return { ok: false, error: "Campaign not found" };
    }

    const tz = (campaign.timezone as string) || "UTC";
    const windowStart = (campaign.calling_window_start as string) ?? "09:00";
    const windowEnd = (campaign.calling_window_end as string) ?? "20:00";
    const callingDays = (campaign.calling_days as number[] | null | undefined) ?? [1, 2, 3, 4, 5];

    const settingsRaw = campaign.settings as unknown;
    const settings =
      typeof settingsRaw === "string"
        ? (() => {
            try {
              return JSON.parse(settingsRaw) as Record<string, unknown>;
            } catch {
              return {};
            }
          })()
        : (settingsRaw as Record<string, unknown> | null) ?? {};

    const configuredInterval =
      typeof settings.call_interval_minutes === "number"
        ? settings.call_interval_minutes
        : typeof settings.call_interval_minutes === "string"
          ? Number(settings.call_interval_minutes)
          : null;

    const callsPerMinute =
      typeof campaign.calls_per_minute === "number" && Number.isFinite(campaign.calls_per_minute)
        ? campaign.calls_per_minute
        : 10;

    // Preferred: explicit "call interval minutes". Fallback: derive interval from calls_per_minute.
    const intervalMinutes =
      configuredInterval && Number.isFinite(configuredInterval) && configuredInterval > 0
        ? Math.min(24 * 60, Math.max(1, Math.floor(configuredInterval)))
        : Math.max(1, Math.floor(60 / Math.max(1, callsPerMinute)));
    const stepMs = intervalMinutes * 60_000;

    const { data: recipients } = await (supabase.from("campaign_recipients") as any)
      .select("id, timezone")
      .eq("campaign_id", campaignId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!recipients?.length) {
      return { ok: true, scheduled: 0 };
    }

    let cursor = nextAllowedStartUtc({
      fromUtc: new Date(),
      timeZone: tz,
      callingWindowStart: windowStart,
      callingWindowEnd: windowEnd,
      callingDays,
    });

    for (const r of recipients) {
      const scheduled = nextAllowedStartUtc({
        fromUtc: cursor,
        timeZone: tz,
        callingWindowStart: windowStart,
        callingWindowEnd: windowEnd,
        callingDays,
      });

      await (supabase.from("campaign_recipients") as any)
        .update({ status: "scheduled", scheduled_at: scheduled.toISOString() })
        .eq("id", r.id)
        .eq("tenant_id", tenantId);

      cursor = new Date(scheduled.getTime() + stepMs);
    }

    return { ok: true, scheduled: recipients.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
