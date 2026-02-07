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
  return transport.request(`/ai/assistants/${assistantId}`, {
    method: "POST",
    body: payload,
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
