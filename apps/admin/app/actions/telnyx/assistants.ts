"use server";

import {
  createAssistant,
  deleteAssistant,
  getAssistant,
  importAssistants,
  listAssistants,
  updateAssistant,
  TelnyxCreateAssistantRequest,
  TelnyxImportAssistantsRequest,
  TelnyxUpdateAssistantRequest,
} from "@tinadmin/telnyx-ai-platform";
import { getTelnyxTransport } from "./client";

export async function listAssistantsAction() {
  const transport = await getTelnyxTransport("integrations.read");
  return listAssistants(transport);
}

export async function getAssistantAction(assistantId: string) {
  const transport = await getTelnyxTransport("integrations.read");
  return getAssistant(transport, assistantId);
}

export async function createAssistantAction(payload: TelnyxCreateAssistantRequest) {
  const transport = await getTelnyxTransport("integrations.write");
  return createAssistant(transport, payload);
}

export async function updateAssistantAction(
  assistantId: string,
  payload: TelnyxUpdateAssistantRequest
) {
  const transport = await getTelnyxTransport("integrations.write");
  return updateAssistant(transport, assistantId, payload);
}

export async function deleteAssistantAction(assistantId: string) {
  const transport = await getTelnyxTransport("integrations.write");
  return deleteAssistant(transport, assistantId);
}

export async function importAssistantsAction(payload: TelnyxImportAssistantsRequest) {
  const transport = await getTelnyxTransport("integrations.write");
  return importAssistants(transport, payload);
}
