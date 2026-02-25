import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/core/database/admin-client";
import {
  getInboundVoiceRoutingForNumber,
  resolveTenantIdFromNumber,
} from "@/src/core/telnyx/voice-agent-lookup";

/**
 * Twilio Voice Webhook handler.
 *
 * Twilio sends a POST when a call arrives on a Twilio number.
 * We resolve the tenant from the called number, look up the voice agent
 * assignment, and return TwiML that routes the call appropriately.
 *
 * For now, the TwiML either:
 * - Connects to a SIP URI / forwarding number (if configured)
 * - Returns a <Say> greeting and hangs up (placeholder for full bridge)
 *
 * Full Telnyx AI assistant bridging or Twilio Media Streams integration
 * can be added as a follow-up.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const params = formData
    ? Object.fromEntries(formData.entries())
    : ((await request.json().catch(() => ({}))) as Record<string, unknown>);

  const callSid = String(params.CallSid ?? params.callSid ?? "");
  const from = String(params.From ?? params.from ?? "");
  const to = String(params.To ?? params.to ?? "");
  const callStatus = String(params.CallStatus ?? params.callStatus ?? "");

  // Resolve tenant from the called number
  const url = new URL(request.url);
  let tenantId =
    url.searchParams.get("tenantId") ||
    url.searchParams.get("tenant_id") ||
    (params.tenantId as string | undefined) ||
    null;

  if (!tenantId && to) {
    tenantId = await resolveTenantIdFromNumber(to);
  }

  if (!tenantId) {
    return twimlResponse(
      "<Response><Say>We could not identify the account for this number. Goodbye.</Say><Hangup/></Response>"
    );
  }

  // Store the event for audit
  try {
    const admin = createAdminClient();
    await (admin.from("telephony_events") as any).insert({
      tenant_id: tenantId,
      provider: "twilio",
      event_type: `call.${callStatus || "initiated"}`,
      external_id: callSid || null,
      payload: params,
    });
  } catch (err) {
    console.error("[TwilioVoiceWebhook] Failed to store event:", err);
  }

  // Look up voice routing for this number
  const routing = await getInboundVoiceRoutingForNumber(tenantId, to);

  if (!routing) {
    return twimlResponse(
      "<Response><Say>No agent is configured for this number. Please contact support.</Say><Hangup/></Response>"
    );
  }

  // Retrieve tenant voice settings for SIP / forwarding
  const admin = createAdminClient();
  const { data: integration } = await (admin.from("integration_configs") as any)
    .select("settings")
    .eq("tenant_id", tenantId)
    .eq("provider", "telnyx")
    .maybeSingle();

  const voiceRouting = (integration?.settings as Record<string, unknown>)?.voiceRouting as
    | Record<string, unknown>
    | undefined;
  const operatorSipUri = (voiceRouting?.operatorSipUri as string)?.trim();

  // If we have a SIP URI, forward the call there (bridges Twilio → operator/Telnyx)
  if (operatorSipUri) {
    return twimlResponse(
      `<Response>` +
      `<Dial callerId="${escapeXml(from)}">` +
      `<Sip>${escapeXml(operatorSipUri)}</Sip>` +
      `</Dial>` +
      `</Response>`
    );
  }

  // Default: greet and inform that full bridging is pending configuration
  return twimlResponse(
    `<Response>` +
    `<Say>Thank you for calling. Your call is being routed to an agent. Please hold.</Say>` +
    `<Pause length="2"/>` +
    `<Say>We are currently setting up advanced call routing for this number. Please try again later or contact support.</Say>` +
    `<Hangup/>` +
    `</Response>`
  );
}

function twimlResponse(twiml: string) {
  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
