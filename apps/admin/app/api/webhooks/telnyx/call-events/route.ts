import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/core/database/admin-client";
import { telnyxWebhookConfig } from "@/src/core/telnyx/config";

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
  const data = payload.data as Record<string, unknown> | undefined;
  return (
    (data?.event_type as string | undefined) ||
    (payload.event_type as string | undefined) ||
    (payload.type as string | undefined) ||
    "unknown"
  );
}

function resolveExternalId(payload: Record<string, unknown>) {
  const data = payload.data as Record<string, unknown> | undefined;
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
    },
  });
}

export async function POST(request: NextRequest) {
  // Get raw body for signature verification (must be before JSON parsing)
  const rawBody = await request.text();
  
  // Verify signature if webhook secret is configured
  if (telnyxWebhookConfig.isConfigured()) {
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
      "TELNYX_WEBHOOK_SECRET not configured. Webhook signature verification is disabled."
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

  return NextResponse.json({ status: "ok" });
}
