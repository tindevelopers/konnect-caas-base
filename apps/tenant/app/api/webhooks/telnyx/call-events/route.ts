import { NextResponse, type NextRequest } from "next/server";
import { createHmac, createPublicKey, verify as cryptoVerify } from "crypto";
import { createAdminClient } from "@/core/database/admin-client";
import { telnyxWebhookConfig } from "@/src/core/telnyx/config";
import { handleTelnyxInboundVoiceEvent } from "@/src/core/telnyx/voice-router";

function resolveTenantId(request: NextRequest, payload: Record<string, unknown>) {
  const headerTenant = request.headers.get("x-tenant-id");
  if (headerTenant) return headerTenant;

  const url = new URL(request.url);
  const queryTenant =
    url.searchParams.get("tenantId") || url.searchParams.get("tenant_id");
  if (queryTenant) return queryTenant;

  const payloadTenant =
    (payload.tenant_id as string | undefined) ||
    (payload.tenantId as string | undefined);
  return payloadTenant;
}

function resolveEventType(payload: Record<string, unknown>) {
  const data =
    (payload.data as Record<string, unknown> | undefined) ||
    ((payload.metadata as Record<string, unknown> | undefined)?.event as
      | Record<string, unknown>
      | undefined);
  return (
    (data?.event_type as string | undefined) ||
    (payload.event_type as string | undefined) ||
    (payload.type as string | undefined) ||
    "unknown"
  );
}

function resolveExternalId(payload: Record<string, unknown>) {
  const data =
    (payload.data as Record<string, unknown> | undefined) ||
    ((payload.metadata as Record<string, unknown> | undefined)?.event as
      | Record<string, unknown>
      | undefined);
  const nestedPayload = (data?.payload as Record<string, unknown> | undefined) ?? {};
  return (
    (nestedPayload.call_control_id as string | undefined) ||
    (nestedPayload.call_leg_id as string | undefined) ||
    (nestedPayload.conversation_id as string | undefined) ||
    (data?.call_control_id as string | undefined) ||
    (data?.call_leg_id as string | undefined) ||
    (data?.conversation_id as string | undefined) ||
    (data?.id as string | undefined) ||
    (payload.call_control_id as string | undefined) ||
    (payload.call_leg_id as string | undefined) ||
    (payload.conversation_id as string | undefined) ||
    (payload.id as string | undefined) ||
    null
  );
}

function shouldStoreAiAgentEvent(eventType: string) {
  const normalized = eventType.toLowerCase();
  return normalized.includes("conversation") || normalized.includes("assistant");
}

/**
 * Verify Telnyx webhook signature using HMAC SHA-256
 * @param rawBody - Raw request body as string (must be exact bytes)
 * @param signature - Signature from telnyx-signature header
 * @param secret - Webhook signing secret from messaging profile
 * @returns true if signature is valid
 */
function verifyTelnyxSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) {
    return false;
  }

  try {
    const hmac = createHmac("sha256", secret);
    hmac.update(rawBody);
    const computedSignature = hmac.digest("hex");
    
    // Use constant-time comparison to prevent timing attacks
    if (computedSignature.length !== signature.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    
    return result === 0;
  } catch (error) {
    console.error("Error verifying Telnyx webhook signature:", error);
    return false;
  }
}

function normalizePublicKeyToPem(publicKey: string) {
  const trimmed = publicKey.trim();
  if (!trimmed) return "";

  // If it already looks like PEM, use it as-is.
  if (trimmed.includes("BEGIN PUBLIC KEY")) {
    return trimmed;
  }

  // Otherwise treat it as base64 DER and wrap into PEM.
  const base64 = trimmed.replace(/\s+/g, "");
  const lines = base64.match(/.{1,64}/g) ?? [base64];
  return [
    "-----BEGIN PUBLIC KEY-----",
    ...lines,
    "-----END PUBLIC KEY-----",
  ].join("\n");
}

/**
 * Verify Telnyx webhook signature using ED25519 (API v2 webhook signing).
 * Signature is computed over `${timestamp}|${payload}` and Base64-encoded.
 */
function verifyTelnyxEd25519Signature(args: {
  rawBody: string;
  timestamp: string;
  signature: string;
  publicKey: string;
}): boolean {
  const { rawBody, timestamp, signature, publicKey } = args;
  if (!rawBody || !timestamp || !signature || !publicKey) return false;

  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;

    // Basic replay protection (allow 5 minutes clock skew).
    if (Math.abs(nowSeconds - ts) > 5 * 60) {
      console.warn("[TelnyxWebhook] Timestamp outside allowed window", {
        nowSeconds,
        ts,
      });
      return false;
    }

    const message = Buffer.from(`${timestamp}|${rawBody}`, "utf8");
    const sig = Buffer.from(signature, "base64");
    const pem = normalizePublicKeyToPem(publicKey);
    const key = createPublicKey(pem);
    return cryptoVerify(null, message, key, sig);
  } catch (error) {
    console.error("Error verifying Telnyx ED25519 signature:", error);
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, x-tenant-id, telnyx-signature, telnyx-signature-ed25519, telnyx-timestamp",
    },
  });
}

export async function POST(request: NextRequest) {
  // Get raw body for signature verification (must be before JSON parsing)
  const rawBody = await request.text();
  
  // Prefer ED25519 (API v2 / Standard Webhooks compatible) if the headers are present.
  const ed25519Signature =
    request.headers.get("telnyx-signature-ed25519") ||
    request.headers.get("Telnyx-Signature-Ed25519");
  const ed25519Timestamp =
    request.headers.get("telnyx-timestamp") || request.headers.get("Telnyx-Timestamp");

  if (ed25519Signature && ed25519Timestamp) {
    if (telnyxWebhookConfig.isEd25519Configured()) {
      const isValid = verifyTelnyxEd25519Signature({
        rawBody,
        timestamp: ed25519Timestamp,
        signature: ed25519Signature,
        publicKey: telnyxWebhookConfig.publicKey,
      });

      if (!isValid) {
        console.error("Telnyx webhook ED25519 signature verification failed");
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    } else {
      console.warn(
        "TELNYX_PUBLIC_KEY not configured. ED25519 webhook signature verification is disabled."
      );
    }
  } else if (telnyxWebhookConfig.isConfigured()) {
    // Legacy HMAC verification (primarily used by some Telnyx products/configs).
    const signature = request.headers.get("telnyx-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing telnyx-signature header" },
        { status: 401 }
      );
    }

    const isValid = verifyTelnyxSignature(
      rawBody,
      signature,
      telnyxWebhookConfig.webhookSecret
    );

    if (!isValid) {
      console.error("Telnyx webhook signature verification failed");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }
  } else {
    console.warn(
      "TELNYX webhook verification not configured. Signature verification is disabled."
    );
  }

  // Parse JSON payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const tenantId = resolveTenantId(request, payload);

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 }
    );
  }

  const eventType = resolveEventType(payload);
  const externalId = resolveExternalId(payload);
  const adminClient = createAdminClient();

  const { error } = await (adminClient.from("telephony_events") as any).insert({
    tenant_id: tenantId,
    provider: "telnyx",
    event_type: eventType,
    external_id: externalId,
    payload,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to store telephony event" },
      { status: 500 }
    );
  }

  if (shouldStoreAiAgentEvent(eventType)) {
    const { error: aiError } = await (adminClient.from("ai_agent_events") as any).insert({
      tenant_id: tenantId,
      provider: "telnyx",
      event_type: eventType,
      external_id: externalId,
      payload,
    });

    if (aiError) {
      return NextResponse.json(
        { error: aiError.message || "Failed to store AI agent event" },
        { status: 500 }
      );
    }
  }

  // Update campaign recipients if this is a campaign call
  try {
    await updateCampaignRecipientFromCallEvent(adminClient, tenantId, eventType, externalId, payload);
  } catch (error) {
    console.error("[TelnyxWebhook] Error updating campaign recipient:", {
      tenantId,
      eventType,
      externalId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Execute inbound call-control logic (best-effort).
  try {
    await handleTelnyxInboundVoiceEvent({ tenantId, payload });
  } catch (error) {
    console.error("[TelnyxWebhook] Error handling inbound voice event:", {
      tenantId,
      eventType,
      externalId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Record AI call costs on call completion (best-effort, fire-and-forget)
  try {
    await recordAiCallCostFromEvent(tenantId, eventType, externalId, payload);
  } catch (error) {
    console.error("[TelnyxWebhook] Error recording AI call cost:", {
      tenantId,
      eventType,
      externalId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json({ status: "ok" });
}

async function updateCampaignRecipientFromCallEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  tenantId: string,
  eventType: string,
  externalId: string | null,
  payload: Record<string, unknown>
) {
  const data = payload.data as Record<string, unknown> | undefined;
  const inner = data?.payload as Record<string, unknown> | undefined;
  const cid =
    externalId ??
    (inner?.call_control_id as string | undefined) ??
    (data?.call_control_id as string | undefined);
  const callControlId = typeof cid === "string" ? cid : null;
  if (!callControlId) return;

  const { data: recipient } = await (adminClient.from("campaign_recipients") as any)
    .select("id, campaign_id")
    .eq("tenant_id", tenantId)
    .eq("call_control_id", callControlId)
    .single();

  if (!recipient) return;

  const norm = eventType.toLowerCase();
  let status: string | null = null;

  if (norm === "call.answered") {
    status = "in_progress";
  } else if (norm === "call.hangup" || norm === "call.completed") {
    const data = payload.data as Record<string, unknown> | undefined;
    const inner = data?.payload as Record<string, unknown> | undefined;
    const cause = (inner?.hangup_cause ?? data?.hangup_cause) as string | undefined;
    const causeNorm = (cause ?? "").toLowerCase();
    if (causeNorm.includes("normal") || causeNorm.includes("clearing")) {
      status = "completed";
    } else if (causeNorm.includes("busy") || causeNorm.includes("no_answer") || causeNorm.includes("no-answer")) {
      status = "no_answer";
    } else if (causeNorm.includes("voicemail")) {
      status = "voicemail";
    } else {
      status = "completed";
    }
  }

  if (status) {
    const updates: Record<string, unknown> = { status };
    if (status === "completed" || status === "no_answer" || status === "voicemail") {
      updates.completed_at = new Date().toISOString();
    }
    await (adminClient.from("campaign_recipients") as any)
      .update(updates)
      .eq("id", recipient.id);

    await (adminClient.from("campaign_events") as any).insert({
      tenant_id: tenantId,
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      event_type: eventType,
      channel: "voice",
      payload,
    });
  }
}

/**
 * Record AI call costs when a call ends.
 * Extracts duration from the webhook payload and records an estimated cost.
 * If a conversation_id is available, attempts to fetch actual cost from Telnyx API.
 */
async function recordAiCallCostFromEvent(
  tenantId: string,
  eventType: string,
  externalId: string | null,
  payload: Record<string, unknown>
) {
  const norm = eventType.toLowerCase();
  // Only process call completion events
  if (norm !== "call.hangup" && norm !== "call.completed" && norm !== "call.machine.detection.ended") {
    return;
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const inner = (data?.payload as Record<string, unknown> | undefined) ?? {};

  // Extract call duration (seconds)
  const durationSec =
    Number(inner.duration_secs ?? inner.duration ?? data?.duration_secs ?? data?.duration ?? 0);

  if (durationSec <= 0) return; // No billable duration

  const durationMin = durationSec / 60;

  // Check if this was an AI assistant call
  const isAiCall =
    Boolean(inner.ai_assistant_id ?? data?.ai_assistant_id) ||
    Boolean(inner.conversation_id ?? data?.conversation_id);

  if (!isAiCall) return; // Only bill AI calls

  const conversationId =
    (inner.conversation_id as string | undefined) ??
    (data?.conversation_id as string | undefined) ??
    externalId;
  const aiAssistantId =
    (inner.ai_assistant_id as string | undefined) ??
    (data?.ai_assistant_id as string | undefined);

  // Estimated cost: Telnyx Conversational AI = ~$0.08/min + $0.002/min call control
  // This is a conservative estimate; real cost comes from Telnyx billing API
  const ESTIMATED_COST_PER_MINUTE = 0.082;
  const estimatedCost = durationMin * ESTIMATED_COST_PER_MINUTE;

  // Try to fetch actual cost from Telnyx conversation API (best-effort)
  let actualCost = estimatedCost;
  if (conversationId) {
    try {
      const { getTelnyxTransport } = await import("@/app/actions/telnyx/client");
      const transport = await getTelnyxTransport("integrations.read");
      const convResponse = await transport.request<any>(`/ai/conversations/${conversationId}`, {
        method: "GET",
      });
      const totalCost = Number(convResponse?.data?.total_cost ?? convResponse?.total_cost ?? 0);
      if (totalCost > 0) {
        actualCost = totalCost;
      }
    } catch {
      // Use estimated cost if API call fails
    }
  }

  // Record the cost
  const { recordCostAndBillAction } = await import("@/app/actions/billing/usage-costs");
  await recordCostAndBillAction({
    tenantId,
    costType: "ai_minutes",
    costAmount: actualCost,
    units: durationMin,
    currency: "USD",
    sourceId: conversationId ?? externalId ?? undefined,
    sourceType: "telnyx_conversation",
    metadata: {
      event_type: eventType,
      duration_seconds: durationSec,
      duration_minutes: durationMin,
      estimated: actualCost === estimatedCost,
      conversation_id: conversationId,
      call_control_id: externalId,
      ai_assistant_id: aiAssistantId ?? null,
    },
  });

  // Also normalize voice usage into agent_usage_events for agent-level reporting.
  if (aiAssistantId) {
    try {
      const adminClient = createAdminClient();
      const { data: agent } = await (adminClient.from("agent_instances") as any)
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("provider", "telnyx")
        .eq("external_ref", aiAssistantId)
        .maybeSingle();

      if (agent?.id) {
        await (adminClient.from("agent_usage_events") as any).insert({
          tenant_id: tenantId,
          agent_id: agent.id,
          channel: "voice",
          provider: "telnyx",
          event_type: "voice.call.completed",
          input_tokens: 0,
          output_tokens: 0,
          audio_seconds: durationSec,
          transcription_seconds: 0,
          tool_calls: 0,
          estimated_cost: actualCost,
          currency: "USD",
          trace_id: conversationId ?? externalId ?? null,
          metadata: {
            conversation_id: conversationId ?? null,
            call_control_id: externalId ?? null,
            ai_assistant_id: aiAssistantId,
            source: "telnyx.call-events.webhook",
          },
        });
      }
    } catch (usageError) {
      console.error("[TelnyxWebhook] Error recording agent voice usage:", {
        tenantId,
        aiAssistantId,
        error: usageError instanceof Error ? usageError.message : String(usageError),
      });
    }
  }
}
