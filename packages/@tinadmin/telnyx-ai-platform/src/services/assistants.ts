import { TelnyxTransport } from "../client/types";
import {
  TelnyxAssistant,
  TelnyxAssistantListResponse,
  TelnyxCloneAssistantResponse,
  TelnyxCreateAssistantRequest,
  TelnyxUpdateAssistantRequest,
  TelnyxImportAssistantsRequest,
  TelnyxImportAssistantsResponse,
} from "../types/assistants";

/**
 * Sanitize payload for Telnyx API - remove undefined, empty voice_settings without voice,
 * and ensure tools is always an array. Telnyx returns 400 "Missing required parameter"
 * when voice_settings is present but voice is empty.
 */
function sanitizeUpdatePayload(
  payload: TelnyxUpdateAssistantRequest
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (key === "voice_settings") {
      const vs = value as Record<string, unknown>;
      const voice = vs?.voice;
      if (typeof voice !== "string" || !voice.trim()) continue;
      out[key] = Object.fromEntries(
        Object.entries(vs).filter(([, v]) => v !== undefined)
      );
      continue;
    }
    if (key === "tools" && !Array.isArray(value)) continue;
    out[key] = value;
  }
  return out;
}

export async function listAssistants(
  transport: TelnyxTransport
): Promise<TelnyxAssistantListResponse> {
  return transport.request("/ai/assistants");
}

export async function getAssistant(
  transport: TelnyxTransport,
  assistantId: string
): Promise<TelnyxAssistant> {
  return transport.request(`/ai/assistants/${assistantId}`);
}

export async function createAssistant(
  transport: TelnyxTransport,
  payload: TelnyxCreateAssistantRequest
): Promise<TelnyxAssistant> {
  return transport.request("/ai/assistants", {
    method: "POST",
    body: payload,
  });
}

export async function updateAssistant(
  transport: TelnyxTransport,
  assistantId: string,
  payload: TelnyxUpdateAssistantRequest
): Promise<TelnyxAssistant> {
  const sanitized = sanitizeUpdatePayload(payload);
  return transport.request(`/ai/assistants/${assistantId}`, {
    method: "POST",
    body: sanitized,
  });
}

export async function cloneAssistant(
  transport: TelnyxTransport,
  assistantId: string
): Promise<TelnyxCloneAssistantResponse> {
  return transport.request(`/ai/assistants/${assistantId}/clone`, {
    method: "POST",
  });
}

export async function deleteAssistant(
  transport: TelnyxTransport,
  assistantId: string
): Promise<void> {
  await transport.request(`/ai/assistants/${assistantId}`, {
    method: "DELETE",
  });
}

export async function importAssistants(
  transport: TelnyxTransport,
  payload: TelnyxImportAssistantsRequest
): Promise<TelnyxImportAssistantsResponse> {
  return transport.request("/ai/assistants/import", {
    method: "POST",
    body: payload,
  });
}
