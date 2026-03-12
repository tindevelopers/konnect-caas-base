"use server";

import { createAdminClient } from "@/core/database/admin-client";
import { createTelnyxClient } from "@tinadmin/telnyx-ai-platform/server";
import {
  getTelnyxIntegrationForWebhook,
} from "@/src/core/telnyx/webhook-transport";
import { nextAllowedStartUtc } from "@/src/core/campaigns/scheduling";

function extractApiKey(credentials: Record<string, unknown> | null): string | null {
  if (!credentials) return null;
  if (typeof credentials.apiKey === "string") return credentials.apiKey;
  if (typeof credentials.api_key === "string") return credentials.api_key;
  return null;
}

function extractCallControlId(response: unknown): string | null {
  const direct = response as { call_control_id?: string };
  if (direct?.call_control_id) return direct.call_control_id;
  const nested = response as { data?: { call_control_id?: string } };
  if (nested?.data?.call_control_id) return nested.data.call_control_id;
  return null;
}

function extractConversationId(response: unknown): string | null {
  const direct = response as { conversation_id?: string };
  if (direct?.conversation_id) return direct.conversation_id;
  const nested = response as { data?: { conversation_id?: string } };
  if (nested?.data?.conversation_id) return nested.data.conversation_id;
  return null;
}

export type ProcessResult = {
  processed: number;
  errors: string[];
};

/**
 * Returns true if the current moment is within the campaign's calling window
 * when interpreted in the given IANA timezone. Also respects calling_days
 * (0=Sunday, 1=Monday, ..., 6=Saturday).
 */
function isWithinCallingWindow(
  timezone: string,
  callingWindowStart: string,
  callingWindowEnd: string,
  callingDays: number[] | null
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(now);
    let hour = "0",
      minute = "0",
      weekday = "";
    for (const p of parts) {
      if (p.type === "hour") hour = p.value;
      else if (p.type === "minute") minute = p.value;
      else if (p.type === "weekday") weekday = p.value;
    }
    const currentMinutes = parseInt(hour, 10) * 60 + parseInt(minute, 10);
    const [startH, startM] = (callingWindowStart || "09:00").split(":").map((s) => parseInt(s, 10) || 0);
    const [endH, endM] = (callingWindowEnd || "20:00").split(":").map((s) => parseInt(s, 10) || 0);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const WEEKDAY_TO_NUM: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayNum = WEEKDAY_TO_NUM[weekday] ?? 0;
    const days = callingDays && callingDays.length > 0 ? callingDays : [1, 2, 3, 4, 5];
    if (!days.includes(dayNum)) return false;

    const inTime =
      startMinutes <= endMinutes
        ? currentMinutes >= startMinutes && currentMinutes < endMinutes
        : currentMinutes >= startMinutes || currentMinutes < endMinutes;
    return inTime;
  } catch {
    return true;
  }
}

export type ProcessCampaignOptions = {
  /** When true (e.g. from "Process now" button), skip calling window check so calls can be placed immediately for testing. */
  bypassCallingWindow?: boolean;
};

/**
 * Process due campaign recipients for voice calls.
 * Uses admin client for background/cron context.
 */
export async function processCampaignVoiceBatch(
  tenantId?: string,
  options?: ProcessCampaignOptions
): Promise<ProcessResult> {
  const admin = createAdminClient();
  const errors: string[] = [];
  let processed = 0;

  const now = new Date().toISOString();

  let campaignsQuery = (admin.from("campaigns") as any)
    .select(
      "id, tenant_id, assistant_id, from_number, settings, max_concurrent_calls, calls_per_minute, max_attempts, retry_delay_minutes, calling_window_start, calling_window_end, calling_days, timezone"
    )
    .eq("status", "running")
    .eq("campaign_type", "voice");

  if (tenantId) {
    campaignsQuery = campaignsQuery.eq("tenant_id", tenantId);
  }

  const { data: campaigns } = await campaignsQuery;

  if (!campaigns?.length) {
    return { processed: 0, errors: [] };
  }

  const bypassCallingWindow = options?.bypassCallingWindow === true;

  for (const campaign of campaigns) {
    const tz = campaign.timezone || "UTC";
    const windowStart = campaign.calling_window_start ?? "09:00";
    const windowEnd = campaign.calling_window_end ?? "20:00";
    const callingDays = campaign.calling_days ?? [1, 2, 3, 4, 5];
    if (!bypassCallingWindow && !isWithinCallingWindow(tz, windowStart, windowEnd, callingDays)) {
      continue;
    }

    // Normalize settings (JSONB can sometimes be string from DB/driver)
    const settings =
      typeof campaign.settings === "string"
        ? (() => {
            try {
              return JSON.parse(campaign.settings) as Record<string, unknown>;
            } catch {
              return {};
            }
          })()
        : (campaign.settings as Record<string, unknown> | undefined) ?? {};

    const connectionId =
      (settings.connection_id as string) ?? process.env.TELNYX_CONNECTION_ID;

    if (!connectionId?.trim()) {
      errors.push(`Campaign ${campaign.id}: No connection_id configured`);
      continue;
    }

    if (!campaign.assistant_id || !campaign.from_number) {
      errors.push(`Campaign ${campaign.id}: Missing assistant_id or from_number`);
      continue;
    }

    const { credentials } = await getTelnyxIntegrationForWebhook(campaign.tenant_id);
    // Match webhook/editor: tenant credentials first so we use same Telnyx account
    // where the assistant was updated (fixes stale prompt when tenant has own Telnyx).
    const apiKey = extractApiKey(credentials as Record<string, unknown> | null) ?? process.env.TELNYX_API_KEY?.trim();
    if (!apiKey) {
      errors.push(`Campaign ${campaign.id}: Telnyx API key not configured`);
      continue;
    }

    const transport = createTelnyxClient({ apiKey });

    // Re-fetch campaign to get latest settings (e.g. greeting) so updates take effect on the next batch.
    const { data: freshCampaign } = await (admin.from("campaigns") as any)
      .select("settings")
      .eq("id", campaign.id)
      .eq("tenant_id", campaign.tenant_id)
      .single();
    const freshSettings =
      freshCampaign?.settings != null
        ? (typeof freshCampaign.settings === "string"
            ? (() => {
                try {
                  return JSON.parse(freshCampaign.settings) as Record<string, unknown>;
                } catch {
                  return settings;
                }
              })()
            : (freshCampaign.settings as Record<string, unknown>)) ?? settings
        : settings;

    // Cap batch size by campaign max_concurrent_calls to avoid Telnyx "connection channel limit exceeded" (90043)
    const batchSize = Math.min(10, Math.max(1, Number(campaign.max_concurrent_calls) || 10));
    // Also respect calls_per_minute as a throttle for cron processing (cron typically runs every ~2 minutes).
    const callsPerMinute = Math.max(1, Math.floor(Number(campaign.calls_per_minute) || 10));
    const throttleLimit = Math.max(1, Math.floor(callsPerMinute * 2));
    const limit = Math.max(1, Math.min(batchSize, throttleLimit));

    const { data: recipients } = await (admin.from("campaign_recipients") as any)
      .select("id, phone, first_name, last_name, attempts")
      .eq("campaign_id", campaign.id)
      .eq("tenant_id", campaign.tenant_id)
      .eq("status", "scheduled")
      .lte("scheduled_at", now)
      .limit(limit);

    if (!recipients?.length) continue;

    for (const r of recipients) {
      try {
        await (admin.from("campaign_recipients") as any)
          .update({ status: "in_progress", last_attempt_at: now, attempts: (r.attempts ?? 0) + 1 })
          .eq("id", r.id);

        const dialResponse = await transport.request("/calls", {
          method: "POST",
          body: {
            connection_id: connectionId.trim(),
            from: campaign.from_number.trim(),
            to: r.phone.trim(),
          },
        });

        const callControlId = extractCallControlId(dialResponse);
        if (!callControlId) {
          throw new Error("No call_control_id in response");
        }

        // Telnyx requires the call to be answered before ai_assistant_start. Set client_state
        // so the webhook can start the assistant on call.answered (same pattern as callAssistantAction).
        // Include campaign greeting only when explicitly set, to avoid double-greeting
        // (assistant configured greeting + per-call greeting).
        // Include automation settings so purchase-flow backend can gate behavior (backward compat: missing = false).
        const customGreeting =
          typeof freshSettings.greeting === "string" && freshSettings.greeting.trim()
            ? freshSettings.greeting.trim().slice(0, 3000)
            : "";
        const hasCampaignGreeting = Boolean(customGreeting);
        const enableProductPurchaseFlow = settings.enableProductPurchaseFlow === true;
        const webhookUrlRaw =
          typeof settings.webhookUrl === "string"
            ? settings.webhookUrl
            : typeof settings.railwayWebhookUrl === "string"
              ? settings.railwayWebhookUrl
              : "";
        const webhookUrl = webhookUrlRaw.trim();
        const statePayload = {
          t: "tinadmin_outbound_assistant",
          a: campaign.assistant_id,
          tid: campaign.tenant_id,
          // g: campaign greeting only (omit when not set; webhook will default)
          g: hasCampaignGreeting ? customGreeting : "",
          cg: hasCampaignGreeting,
          pf: enableProductPurchaseFlow,
          rw: webhookUrl,
        };
        const clientState = Buffer.from(JSON.stringify(statePayload), "utf8").toString("base64");
        try {
          await transport.request(
            `/calls/${callControlId}/actions/client_state_update`,
            { method: "PUT", body: { client_state: clientState } }
          );
        } catch (stateErr) {
          console.warn("[CampaignExecutor] client_state_update failed:", stateErr);
        }

        await (admin.from("campaign_recipients") as any)
          .update({ call_control_id: callControlId })
          .eq("id", r.id);

        await (admin.from("campaign_events") as any).insert({
          tenant_id: campaign.tenant_id,
          campaign_id: campaign.id,
          recipient_id: r.id,
          event_type: "call.initiated",
          channel: "voice",
          payload: { call_control_id: callControlId },
        });

        processed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Campaign ${campaign.id}: Recipient ${r.id}: ${msg}`);
        const nextAttempts = (r.attempts ?? 0) + 1;
        const maxAttempts = Math.max(0, Math.floor(Number(campaign.max_attempts) || 3));
        const retryDelay = Math.max(1, Math.floor(Number(campaign.retry_delay_minutes) || 60));

        if (maxAttempts > 0 && nextAttempts < maxAttempts) {
          const retryBase = new Date(Date.now() + retryDelay * 60_000);
          const retryAt = nextAllowedStartUtc({
            fromUtc: retryBase,
            timeZone: tz,
            callingWindowStart: windowStart,
            callingWindowEnd: windowEnd,
            callingDays,
          });

          await (admin.from("campaign_recipients") as any)
            .update({
              status: "scheduled",
              scheduled_at: retryAt.toISOString(),
              result: { error: msg, will_retry: true },
            })
            .eq("id", r.id);
        } else {
          await (admin.from("campaign_recipients") as any)
            .update({ status: "failed", result: { error: msg } })
            .eq("id", r.id);
        }
      }
    }
  }

  return { processed, errors };
}
