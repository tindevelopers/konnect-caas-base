"use server";

import { createAdminClient } from "@/core/database/admin-client";
import { createTelnyxClient } from "@tinadmin/telnyx-ai-platform/server";
import {
  getTelnyxIntegrationForWebhook,
} from "@/src/core/telnyx/webhook-transport";

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
 * Process due campaign recipients for voice calls.
 * Uses admin client for background/cron context.
 */
export async function processCampaignVoiceBatch(
  tenantId?: string
): Promise<ProcessResult> {
  const admin = createAdminClient();
  const errors: string[] = [];
  let processed = 0;

  const now = new Date().toISOString();

  let campaignsQuery = (admin.from("campaigns") as any)
    .select("id, tenant_id, assistant_id, from_number, settings, max_concurrent_calls")
    .eq("status", "running")
    .eq("campaign_type", "voice");

  if (tenantId) {
    campaignsQuery = campaignsQuery.eq("tenant_id", tenantId);
  }

  const { data: campaigns } = await campaignsQuery;

  if (!campaigns?.length) {
    return { processed: 0, errors: [] };
  }

  const DEFAULT_GREETING =
    "Hi, this is calling from PetStore Direct. We work with professional grooming salons on wholesale supply pricing. Am I speaking with the person who handles grooming supply purchases?";

  for (const campaign of campaigns) {
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
    const apiKey = extractApiKey(credentials as Record<string, unknown> | null) ?? process.env.TELNYX_API_KEY;
    if (!apiKey) {
      errors.push(`Campaign ${campaign.id}: Telnyx API key not configured`);
      continue;
    }

    const transport = createTelnyxClient({ apiKey });

    // Cap batch size by campaign max_concurrent_calls to avoid Telnyx "connection channel limit exceeded" (90043)
    const batchSize = Math.min(10, Math.max(1, Number(campaign.max_concurrent_calls) || 10));

    const { data: recipients } = await (admin.from("campaign_recipients") as any)
      .select("id, phone, first_name, last_name, attempts")
      .eq("campaign_id", campaign.id)
      .eq("tenant_id", campaign.tenant_id)
      .eq("status", "scheduled")
      .lte("scheduled_at", now)
      .limit(batchSize);

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
        // Always include g (greeting) so the webhook has it; use campaign greeting or default.
        const customGreeting =
          typeof settings.greeting === "string" && settings.greeting.trim()
            ? settings.greeting.trim().slice(0, 3000)
            : "";
        const greeting = customGreeting || DEFAULT_GREETING;
        const statePayload = {
          t: "tinadmin_outbound_assistant",
          a: campaign.assistant_id,
          tid: campaign.tenant_id,
          g: greeting,
        };
        const clientState = Buffer.from(JSON.stringify(statePayload), "utf8").toString("base64");
        try {
          await transport.request(
            `/calls/${callControlId}/actions/client_state_update`,
            { method: "PUT", body: { client_state: clientState } }
          );
          // #region agent log
          fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "executor.ts:client_state_update",
              message: "client_state_update succeeded",
              data: { campaignId: campaign.id, callControlId },
              timestamp: Date.now(),
              hypothesisId: "H5",
            }),
          }).catch(() => {});
          // #endregion
        } catch (stateErr) {
          // #region agent log
          fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "executor.ts:client_state_update-err",
              message: "client_state_update failed",
              data: { campaignId: campaign.id, error: stateErr instanceof Error ? stateErr.message : String(stateErr) },
              timestamp: Date.now(),
              hypothesisId: "H5",
            }),
          }).catch(() => {});
          // #endregion
          // Log but continue; webhook may still start assistant if state was set elsewhere
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
        await (admin.from("campaign_recipients") as any)
          .update({ status: "failed", result: { error: msg } })
          .eq("id", r.id);
      }
    }
  }

  return { processed, errors };
}
