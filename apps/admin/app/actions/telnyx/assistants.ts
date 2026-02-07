"use server";

import {
  cloneAssistant,
  createAssistant,
  deleteAssistant,
  getAssistant,
  importAssistants,
  listAssistants,
  TelnyxCloneAssistantResponse,
  updateAssistant,
  TelnyxCreateAssistantRequest,
  TelnyxImportAssistantsRequest,
  TelnyxUpdateAssistantRequest,
} from "@tinadmin/telnyx-ai-platform/server";
import { headers } from "next/headers";
import { getTelnyxTransport } from "./client";
import { trackApiCall } from "@/src/core/telemetry";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { createClient } from "@/core/database/server";

const TELNYX_PROVIDER = "telnyx";

interface CallAssistantPayload {
  assistantId: string;
  toNumber: string;
  fromNumber: string;
  connectionId: string;
}

interface CallAssistantResult {
  callControlId: string;
  conversationId?: string | null;
}

async function getTelemetryContext() {
  let tenantId: string | null = null;
  let userId: string | null = null;
  
  try {
    tenantId = await ensureTenantId().catch(() => null);
  } catch {
    // Ignore
  }
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {
    // Ignore
  }
  
  return { tenantId, userId };
}

function redactPhoneNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const last4 = trimmed.slice(-4);
  return `***${last4}`;
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

export async function listAssistantsAction() {
  const { tenantId, userId } = await getTelemetryContext();
  
  try {
    const transport = await getTelnyxTransport("integrations.read");
    
    return trackApiCall(
      "listAssistants",
      TELNYX_PROVIDER,
      () => listAssistants(transport),
      { tenantId, userId }
    );
  } catch (error) {
    // Improve error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        throw new Error(
          "Telnyx API authentication failed (401). Please verify your API key is valid and has the correct permissions. " +
          "Check your Telnyx API key in System Admin → Integrations → Telnyx"
        );
      }
      if (error.message.includes("Tenant context missing")) {
        throw new Error(
          "Tenant context missing. Please select a tenant or configure the platform default Telnyx integration."
        );
      }
    }
    throw error;
  }
}

export async function getAssistantAction(assistantId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  const transport = await getTelnyxTransport("integrations.read");
  
  return trackApiCall(
    "getAssistant",
    TELNYX_PROVIDER,
    () => getAssistant(transport, assistantId),
    {
      tenantId,
      userId,
      requestData: { assistantId },
    }
  );
}

export async function createAssistantAction(payload: TelnyxCreateAssistantRequest) {
  const { tenantId, userId } = await getTelemetryContext();
  const transport = await getTelnyxTransport("integrations.write");
  
  return trackApiCall(
    "createAssistant",
    TELNYX_PROVIDER,
    () => createAssistant(transport, payload),
    {
      tenantId,
      userId,
      requestData: {
        name: payload.name,
        model: payload.model,
        instructions: payload.instructions ? "[REDACTED]" : undefined,
      },
    }
  );
}

export async function updateAssistantAction(
  assistantId: string,
  payload: TelnyxUpdateAssistantRequest
) {
  const { tenantId, userId } = await getTelemetryContext();
  const transport = await getTelnyxTransport("integrations.write");
  
  return trackApiCall(
    "updateAssistant",
    TELNYX_PROVIDER,
    () => updateAssistant(transport, assistantId, payload),
    {
      tenantId,
      userId,
      requestData: {
        assistantId,
        name: payload.name,
        model: payload.model,
      },
    }
  );
}

export async function cloneAssistantAction(
  assistantId: string
): Promise<TelnyxCloneAssistantResponse> {
  if (!assistantId) {
    throw new Error("Assistant ID is required to clone.");
  }

  const { tenantId, userId } = await getTelemetryContext();
  const transport = await getTelnyxTransport("integrations.write");

  return trackApiCall(
    "cloneAssistant",
    TELNYX_PROVIDER,
    async () => {
      const response = await cloneAssistant(transport, assistantId);
      const clonedId = response?.id ?? (response as { data?: { id?: string } })?.data?.id;
      if (!clonedId) {
        throw new Error("Clone succeeded but no assistant ID was returned.");
      }
      return { id: clonedId };
    },
    {
      tenantId,
      userId,
      requestData: { assistantId },
    }
  );
}

export async function deleteAssistantAction(assistantId: string) {
  const { tenantId, userId } = await getTelemetryContext();
  const transport = await getTelnyxTransport("integrations.write");
  
  return trackApiCall(
    "deleteAssistant",
    TELNYX_PROVIDER,
    () => deleteAssistant(transport, assistantId),
    {
      tenantId,
      userId,
      requestData: { assistantId },
    }
  );
}

export async function importAssistantsAction(payload: TelnyxImportAssistantsRequest) {
  const { tenantId, userId } = await getTelemetryContext();
  const transport = await getTelnyxTransport("integrations.write");
  
  return trackApiCall(
    "importAssistants",
    TELNYX_PROVIDER,
    () => importAssistants(transport, payload),
    {
      tenantId,
      userId,
      requestData: {
        provider: payload.provider,
        api_key_ref: payload.api_key_ref,
        import_ids_count: payload.import_ids?.length || 0,
      },
    }
  );
}

export async function callAssistantAction(payload: CallAssistantPayload): Promise<CallAssistantResult> {
  const { assistantId, toNumber, fromNumber, connectionId } = payload;
  if (!assistantId) {
    throw new Error("Assistant ID is required.");
  }
  if (!toNumber?.trim()) {
    throw new Error("Destination phone number is required.");
  }
  if (!fromNumber?.trim()) {
    throw new Error("Caller (from) number is required.");
  }
  if (!connectionId?.trim()) {
    throw new Error("Call Control connection ID is required.");
  }

  const { tenantId, userId } = await getTelemetryContext();
  const transport = await getTelnyxTransport("integrations.write");

  return trackApiCall(
    "callAssistant",
    TELNYX_PROVIDER,
    async () => {
      const dialResponse = await transport.request("/calls", {
        method: "POST",
        body: {
          connection_id: connectionId.trim(),
          from: fromNumber.trim(),
          to: toNumber.trim(),
        },
      });

      const callControlId = extractCallControlId(dialResponse);
      if (!callControlId) {
        throw new Error("Telnyx dial did not return a call_control_id.");
      }

      const startResponse = await transport.request(
        `/calls/${callControlId}/actions/ai_assistant_start`,
        {
          method: "POST",
          body: {
            assistant: {
              assistant_id: assistantId,
            },
          },
        }
      );

      const conversationId = extractConversationId(startResponse);
      return { callControlId, conversationId };
    },
    {
      tenantId,
      userId,
      requestData: {
        assistantId,
        toNumber: redactPhoneNumber(toNumber),
        fromNumber: redactPhoneNumber(fromNumber),
        connectionId,
      },
    }
  );
}

export async function getCallInstructionsAction(assistantId: string) {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3010";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  return {
    assistantId,
    webhookUrl: `${baseUrl}/api/webhooks/telnyx/call-events`,
    tenantHeader: "x-tenant-id",
    tenantQueryParam: "tenantId",
    steps: [
      "Create or open your Call Control App in Telnyx Mission Control.",
      "Set the Webhook URL to the value shown below.",
      "Include the tenant context using x-tenant-id header or ?tenantId= query param.",
      "Use this assistant ID when starting the AI assistant for inbound calls.",
    ],
  };
}
