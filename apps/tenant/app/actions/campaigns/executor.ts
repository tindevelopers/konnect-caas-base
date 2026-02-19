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
    .select("id, tenant_id, assistant_id, from_number, settings")
    .eq("status", "running")
    .eq("campaign_type", "voice");

  if (tenantId) {
    campaignsQuery = campaignsQuery.eq("tenant_id", tenantId);
  }

  const { data: campaigns } = await campaignsQuery;

  if (!campaigns?.length) {
    return { processed: 0, errors: [] };
  }

  for (const campaign of campaigns) {
    const connectionId =
      (campaign.settings?.connection_id as string) ??
      process.env.TELNYX_CONNECTION_ID;

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

    const { data: recipients } = await (admin.from("campaign_recipients") as any)
      .select("id, phone, first_name, last_name, attempts")
      .eq("campaign_id", campaign.id)
      .eq("tenant_id", campaign.tenant_id)
      .eq("status", "scheduled")
      .lte("scheduled_at", now)
      .limit(10);

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

        const startResponse = await transport.request(
          `/calls/${callControlId}/actions/ai_assistant_start`,
          {
            method: "POST",
            body: {
              assistant: { id: campaign.assistant_id },
            },
          }
        );
        const conversationId = extractConversationId(startResponse);

        await (admin.from("campaign_recipients") as any)
          .update({
            call_control_id: callControlId,
            conversation_id: conversationId ?? null,
          })
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
        errors.push(`Recipient ${r.id}: ${msg}`);
        await (admin.from("campaign_recipients") as any)
          .update({ status: "failed", result: { error: msg } })
          .eq("id", r.id);
      }
    }
  }

  return { processed, errors };
}
