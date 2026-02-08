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
  listAssistantTests,
  createAssistantTest,
  triggerAssistantTestRun,
} from "@tinadmin/telnyx-ai-platform";
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
  streamUrl?: string; // Optional WebSocket URL for audio streaming
  streamTrack?: "inbound_track" | "outbound_track" | "both_tracks"; // Which audio track to stream
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
      if (error.message.includes("not configured") || error.message.includes("API key")) {
        throw new Error(
          "Telnyx API key not configured. " +
          "Please configure Telnyx integration: System Admin → Integrations → Telephony → Telnyx, " +
          "or set TELNYX_API_KEY environment variable."
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
  console.log("[callAssistantAction] Starting call with payload:", {
    assistantId: payload.assistantId,
    toNumber: payload.toNumber ? "***" + payload.toNumber.slice(-4) : "missing",
    fromNumber: payload.fromNumber ? "***" + payload.fromNumber.slice(-4) : "missing",
    connectionId: payload.connectionId ? "***" + payload.connectionId.slice(-4) : "missing",
  });
  
  try {
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
    
    let transport: Awaited<ReturnType<typeof getTelnyxTransport>>;
    try {
      transport = await getTelnyxTransport("integrations.write");
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Tenant context missing")) {
          throw new Error(
            "Tenant context missing. Please select a tenant or configure the platform default Telnyx integration."
          );
        }
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          throw new Error(
            "Telnyx API authentication failed (401). Please verify your API key is valid. " +
            "Check your Telnyx API key in System Admin → Integrations → Telnyx"
          );
        }
      }
      throw error;
    }

    return trackApiCall(
      "callAssistant",
      TELNYX_PROVIDER,
      async () => {
        try {
          // Build dial request body
          const dialBody: Record<string, string> = {
            connection_id: connectionId.trim(),
            from: fromNumber.trim(),
            to: toNumber.trim(),
          };

          // Add streaming if streamUrl is provided
          if (payload.streamUrl?.trim()) {
            dialBody.stream_url = payload.streamUrl.trim();
            dialBody.stream_track = payload.streamTrack || "both_tracks";
          }

          const dialResponse = await transport.request("/calls", {
            method: "POST",
            body: dialBody,
          });

          const callControlId = extractCallControlId(dialResponse);
          if (!callControlId) {
            const responseStr = JSON.stringify(dialResponse, null, 2);
            throw new Error(
              `Telnyx dial did not return a call_control_id. Response: ${responseStr.substring(0, 500)}`
            );
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
        } catch (error) {
          // Improve error messages for Telnyx API errors
          if (error instanceof Error) {
            if (error.message.includes("404")) {
              throw new Error(
                "Call Control App ID not found. Please verify the Connection ID is correct in Telnyx Mission Control."
              );
            }
            if (error.message.includes("400")) {
              throw new Error(
                "Invalid request parameters. Please check phone numbers and Call Control App ID format."
              );
            }
            if (error.message.includes("422")) {
              throw new Error(
                "Invalid assistant configuration. Please verify the assistant ID exists and is properly configured."
              );
            }
          }
          throw error;
        }
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
  } catch (error) {
    console.error("[callAssistantAction] Error:", error);
    // Ensure errors are properly formatted for client consumption
    if (error instanceof Error) {
      // Log full error details for debugging
      console.error("[callAssistantAction] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw error;
    }
    const errorMessage = `Failed to start call: ${String(error)}`;
    console.error("[callAssistantAction] Non-Error thrown:", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function hangUpCallAction(callControlId: string): Promise<void> {
  if (!callControlId?.trim()) {
    throw new Error("Call Control ID is required to hang up.");
  }

  const { tenantId, userId } = await getTelemetryContext();
  
  let transport: Awaited<ReturnType<typeof getTelnyxTransport>>;
  try {
    transport = await getTelnyxTransport("integrations.write");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Tenant context missing")) {
        throw new Error(
          "Tenant context missing. Please select a tenant or configure the platform default Telnyx integration."
        );
      }
    }
    throw error;
  }

  return trackApiCall(
    "hangUpCall",
    TELNYX_PROVIDER,
    async () => {
      await transport.request(`/calls/${callControlId}/actions/hangup`, {
        method: "POST",
        body: {},
      });
    },
    {
      tenantId,
      userId,
      requestData: {
        callControlId,
      },
    }
  );
}

export async function getCallInstructionsAction(assistantId: string) {
  try {
    if (!assistantId?.trim()) {
      throw new Error("Assistant ID is required.");
    }

    const h = await headers();
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
  } catch (error) {
    // Ensure errors are properly formatted for client consumption
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get call instructions: ${String(error)}`);
  }
}

interface TestCallResult {
  testId: string;
  runId: string;
  conversationId?: string | null;
  status: string;
}

/**
 * Test call action that uses Telnyx's test run API to simulate a call without dialing a real number.
 * This creates a test (if one doesn't exist) and triggers a test run.
 */
export async function testCallAssistantAction(assistantId: string): Promise<TestCallResult> {
  console.log("[testCallAssistantAction] Starting test call for assistant:", assistantId);
  
  try {
    if (!assistantId?.trim()) {
      throw new Error("Assistant ID is required.");
    }

    const { tenantId, userId } = await getTelemetryContext();
    const transport = await getTelnyxTransport("integrations.write");

    return trackApiCall(
      "testCallAssistant",
      TELNYX_PROVIDER,
      async () => {
        // Get the assistant to retrieve its version_id
        const assistant = await getAssistant(transport, assistantId);
        const versionId = (assistant as any).version_id || assistantId;
        
        // First, try to find an existing test
        const testsResponse = await listAssistantTests(transport);
        
        let testId: string;
        const existingTests = testsResponse.data || [];
        
        // Look for a test that matches this assistant or use the first one
        // If no tests exist, create a new one
        if (existingTests.length > 0) {
          // Use the first existing test (tests are reusable)
          testId = existingTests[0].test_id;
          console.log("[testCallAssistantAction] Using existing test:", testId);
        } else {
          // Create a new test
          // Note: Tests require a destination, but we'll use a placeholder
          // The test run simulates the conversation without actually dialing
          const testName = `Quick Test - ${assistantId.slice(0, 8)}`;
          const testPayload = {
            name: testName,
            destination: assistantId, // For web_chat channel, use assistant ID as destination
            telnyx_conversation_channel: "web_chat", // Use web_chat for internal testing (no real calls)
            instructions: "Test the assistant's response to a simple greeting and question.",
            rubric: [
              {
                name: "greeting_response",
                criteria: "Assistant should respond appropriately to greeting",
              },
              {
                name: "question_handling",
                criteria: "Assistant should handle questions correctly",
              },
            ],
            description: `Quick test for assistant ${assistantId}`,
            max_duration_seconds: 60,
          };
          
          const createdTest = await createAssistantTest(transport, testPayload);
          testId = createdTest.test_id;
          console.log("[testCallAssistantAction] Created new test:", testId);
        }

        // Trigger the test run with the assistant version_id
        const testRun = await triggerAssistantTestRun(transport, testId, {
          destination_version_id: versionId,
        });
        
        return {
          testId,
          runId: testRun.run_id,
          conversationId: testRun.conversation_id || null,
          status: testRun.status,
        };
      },
      {
        tenantId,
        userId,
        requestData: {
          assistantId,
        },
      }
    );
  } catch (error) {
    console.error("[testCallAssistantAction] Error:", error);
    if (error instanceof Error) {
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        throw new Error(
          "Telnyx API authentication failed (401). Please verify your API key is valid. " +
          "Check your Telnyx API key in System Admin → Integrations → Telnyx"
        );
      }
      if (error.message.includes("404")) {
        throw new Error(
          "Assistant not found. Please verify the assistant ID is correct."
        );
      }
      throw error;
    }
    throw new Error(`Failed to start test call: ${String(error)}`);
  }
}
