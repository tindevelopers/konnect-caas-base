import "server-only";

import { createHash } from "crypto";
import { getTelnyxTransportForWebhook } from "@/src/core/telnyx/webhook-transport";
import { getInboundAssistantIdForNumber } from "@/src/core/telnyx/voice-agent-lookup";

type UnknownRecord = Record<string, unknown>;

const INBOUND_AI_RECEPTIONIST_CLIENT_STATE = Buffer.from(
  "tinadmin:ai_receptionist_inbound:v1",
  "utf8"
).toString("base64");

function resolveData(payload: UnknownRecord): UnknownRecord {
  const data = payload.data;
  if (data && typeof data === "object") return data as UnknownRecord;
  const metadata = payload.metadata;
  if (metadata && typeof metadata === "object") {
    const event = (metadata as UnknownRecord).event;
    if (event && typeof event === "object") return event as UnknownRecord;
  }
  return payload;
}

function resolveEventType(payload: UnknownRecord): string {
  const data = resolveData(payload);
  const eventType =
    (data.event_type as string | undefined) ||
    (payload.event_type as string | undefined) ||
    (payload.type as string | undefined) ||
    "unknown";
  return eventType;
}

function resolveEventId(payload: UnknownRecord): string | null {
  const data = resolveData(payload);
  const id = (data.id as string | undefined) || (payload.id as string | undefined);
  return id ?? null;
}

function resolveCallPayload(payload: UnknownRecord): UnknownRecord {
  const data = resolveData(payload);
  const nested = data.payload;
  if (nested && typeof nested === "object") return nested as UnknownRecord;
  return data;
}

function resolveCallControlId(payload: UnknownRecord): string | null {
  const data = resolveData(payload);
  const callPayload = resolveCallPayload(payload);
  return (
    (callPayload.call_control_id as string | undefined) ||
    (data.call_control_id as string | undefined) ||
    (payload.call_control_id as string | undefined) ||
    null
  );
}

function resolveDirection(payload: UnknownRecord): "incoming" | "outgoing" | null {
  const callPayload = resolveCallPayload(payload);
  const direction = callPayload.direction;
  if (direction === "incoming" || direction === "outgoing") return direction;
  return null;
}

function resolveClientState(payload: UnknownRecord): string | null {
  const callPayload = resolveCallPayload(payload);
  const value = callPayload.client_state;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function resolveDtmfDigit(payload: UnknownRecord): string | null {
  const callPayload = resolveCallPayload(payload);
  const digit =
    (callPayload.digit as string | undefined) ||
    (callPayload.digits as string | undefined) ||
    null;
  if (!digit) return null;
  return String(digit);
}

function resolveGatherDigits(payload: UnknownRecord): string | null {
  const callPayload = resolveCallPayload(payload);
  const digits = (callPayload.digits as string | undefined) || null;
  return digits ? String(digits) : null;
}

/** Resolve the called number (our number for inbound) from the call payload. */
function resolveToNumber(payload: UnknownRecord): string | null {
  const callPayload = resolveCallPayload(payload);
  const to = callPayload.to;
  return typeof to === "string" && to.trim() ? to.trim() : null;
}

function commandId(parts: string[]) {
  // Telnyx ignores duplicate command_id values for 60s; keep deterministic per webhook event.
  const digest = createHash("sha256").update(parts.join("|")).digest("hex");
  return digest.slice(0, 40);
}

export async function handleTelnyxInboundVoiceEvent(args: {
  tenantId: string;
  payload: UnknownRecord;
}) {
  const { tenantId, payload } = args;
  const eventType = resolveEventType(payload);
  const eventId = resolveEventId(payload) ?? "no_event_id";
  const callControlId = resolveCallControlId(payload);
  const direction = resolveDirection(payload);

  if (!callControlId) {
    return;
  }

  // Only handle inbound leg for call-init/answer/start. (Transfer creates an outbound leg too.)
  const isInboundLeg = direction === "incoming" || direction === null;

  const { transport, settings } = await getTelnyxTransportForWebhook(tenantId);
  const routing = settings?.voiceRouting ?? {};
  const operatorSipUri = routing.operatorSipUri?.trim();
  const escapeDigit = (routing.escapeDigit?.trim() || "0").slice(0, 1);

  // Resolve assistant: per-number assignment first, then tenant default
  const toNumber = resolveToNumber(payload);
  const perNumberAssistantId =
    toNumber ? await getInboundAssistantIdForNumber(tenantId, toNumber) : null;
  const inboundAssistantId =
    (perNumberAssistantId ?? routing.inboundAssistantId ?? "").trim();

  if (!inboundAssistantId || !operatorSipUri) {
    console.warn("[TelnyxVoiceRouter] Missing voice routing settings", {
      tenantId,
      eventType,
      callControlId,
      hasInboundAssistantId: Boolean(inboundAssistantId),
      hasOperatorSipUri: Boolean(operatorSipUri),
    });
    return;
  }

  // ---- Event handlers ----
  if (eventType === "call.initiated" && isInboundLeg) {
    // Answer ASAP; start assistant on call.answered for reliability.
    await transport.request(`/calls/${callControlId}/actions/answer`, {
      method: "POST",
      body: {
        client_state: INBOUND_AI_RECEPTIONIST_CLIENT_STATE,
        command_id: commandId(["answer", callControlId, eventId]),
      },
    });
    return;
  }

  if (eventType === "call.answered" && isInboundLeg) {
    // Only start the receptionist flow if this is the call leg we answered.
    const clientState = resolveClientState(payload);
    if (clientState !== INBOUND_AI_RECEPTIONIST_CLIENT_STATE) {
      return;
    }

    // Start the assistant and arm a gather for the escape digit.
    await transport.request(`/calls/${callControlId}/actions/ai_assistant_start`, {
      method: "POST",
      body: {
        assistant: { assistant_id: inboundAssistantId },
        // Keep greeting minimal; the assistant's own greeting can also be configured in Telnyx.
        greeting: routing.greeting || `Hi. You can say how I can help, or press ${escapeDigit} for an operator.`,
        command_id: commandId(["ai_assistant_start", callControlId, eventId]),
      },
    });

    await transport.request(`/calls/${callControlId}/actions/gather`, {
      method: "POST",
      body: {
        valid_digits: escapeDigit,
        minimum_digits: 1,
        maximum_digits: 1,
        timeout_millis: 60000,
        initial_timeout_millis: 60000,
        gather_id: "operator_escape",
        command_id: commandId(["gather_arm", callControlId, eventId]),
      },
    });

    return;
  }

  if (eventType === "call.dtmf.received") {
    const digit = resolveDtmfDigit(payload);
    if (digit !== escapeDigit) return;

    // Best-effort stop assistant, then transfer.
    try {
      await transport.request(`/calls/${callControlId}/actions/ai_assistant_stop`, {
        method: "POST",
        body: {
          command_id: commandId(["ai_assistant_stop", callControlId, eventId]),
        },
      });
    } catch (error) {
      console.warn("[TelnyxVoiceRouter] ai_assistant_stop failed (continuing)", {
        tenantId,
        callControlId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await transport.request(`/calls/${callControlId}/actions/transfer`, {
      method: "POST",
      body: {
        to: operatorSipUri,
        command_id: commandId(["transfer_operator", callControlId, eventId]),
      },
    });
    return;
  }

  if (eventType === "call.gather.ended") {
    const digits = resolveGatherDigits(payload);
    if (digits === escapeDigit) {
      await transport.request(`/calls/${callControlId}/actions/transfer`, {
        method: "POST",
        body: {
          to: operatorSipUri,
          command_id: commandId(["transfer_operator", callControlId, eventId]),
        },
      });
      return;
    }

    // Re-arm gather so escape stays available.
    await transport.request(`/calls/${callControlId}/actions/gather`, {
      method: "POST",
      body: {
        valid_digits: escapeDigit,
        minimum_digits: 1,
        maximum_digits: 1,
        timeout_millis: 60000,
        initial_timeout_millis: 60000,
        gather_id: "operator_escape",
        command_id: commandId(["gather_rearm", callControlId, eventId]),
      },
    });
    return;
  }
}

