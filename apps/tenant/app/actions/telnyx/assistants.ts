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
  // #region agent log
  fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "assistants.ts:listAssistantsAction",
      message: "entry",
      data: {},
      timestamp: Date.now(),
      hypothesisId: "A",
      runId: "listAssistants",
    }),
  }).catch(() => {});
  // #endregion
  const { tenantId, userId } = await getTelemetryContext();
  // #region agent log
  fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "assistants.ts:listAssistantsAction",
      message: "after getTelemetryContext",
      data: { hasTenantId: !!tenantId },
      timestamp: Date.now(),
      hypothesisId: "A",
      runId: "listAssistants",
    }),
  }).catch(() => {});
  // #endregion

  try {
    const transport = await getTelnyxTransport("integrations.read");
    // #region agent log
    fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "assistants.ts:listAssistantsAction",
        message: "after getTelnyxTransport",
        data: {},
        timestamp: Date.now(),
        hypothesisId: "C",
        runId: "listAssistants",
      }),
    }).catch(() => {});
    // #endregion

    return trackApiCall(
      "listAssistants",
      TELNYX_PROVIDER,
      () => listAssistants(transport),
      { tenantId, userId }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // Server-side log for Vercel/production debugging (Next.js masks error message in prod)
    console.error("[listAssistantsAction] caught:", errMsg);
    // #region agent log
    fetch("http://127.0.0.1:7251/ingest/383b5b76-17df-49d2-b319-3ebc9439ed93", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "assistants.ts:listAssistantsAction",
        message: "catch",
        data: { errMsg: errMsg.slice(0, 120) },
        timestamp: Date.now(),
        hypothesisId: "E",
        runId: "listAssistants",
      }),
    }).catch(() => {});
    // #endregion
    // Next.js strips error.message in production; set digest so the client can show it (digest is left intact)
    const setDigest = (e: Error, msg: string) => {
      (e as Error & { digest?: string }).digest = msg;
      return e;
    };
    // Improve error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        throw setDigest(
          new Error(
            "Telnyx API authentication failed (401). Please verify your API key is valid and has the correct permissions. " +
              "Check your Telnyx API key in System Admin → Integrations → Telnyx"
          ),
          "Telnyx API authentication failed (401). Please verify your API key in System Admin → Integrations → Telnyx."
        );
      }
      if (error.message.includes("Tenant context missing")) {
        throw setDigest(
          new Error(
            "Tenant context missing. Please select a tenant or configure the platform default Telnyx integration."
          ),
          "Tenant context missing. Please select a tenant or configure the platform default Telnyx integration."
        );
      }
      if (error.message.includes("not configured") || error.message.includes("API key")) {
        throw setDigest(
          new Error(
            "Telnyx API key not configured. " +
              "Please configure Telnyx integration: System Admin → Integrations → Telephony → Telnyx, " +
              "or set TELNYX_API_KEY environment variable."
          ),
          "Telnyx API key not configured. Configure in System Admin → Integrations or set TELNYX_API_KEY."
        );
      }
      if (
        /INTEGRATION_CREDENTIALS_KEY|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_SUPABASE/i.test(error.message)
      ) {
        throw setDigest(
          new Error(
            "Telnyx API key not configured. Set TELNYX_API_KEY in Vercel (or in System Admin → Integrations), or configure integration credentials on the server."
          ),
          "Telnyx API key not configured. Set TELNYX_API_KEY or configure integration credentials on the server."
        );
      }
    }
    // Never rethrow raw error in production; digest ensures client sees this in prod (message is stripped)
    throw setDigest(
      new Error(
        "Unable to load assistants. Please check your Telnyx integration (API key and tenant) and try again."
      ),
      "Unable to load assistants. Please check your Telnyx integration (API key and tenant) and try again."
    );
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
            const streamUrl = payload.streamUrl.trim();
            dialBody.stream_url = streamUrl;
            dialBody.stream_track = payload.streamTrack || "both_tracks";
            
            console.log("[TELEMETRY] callAssistantAction - Adding stream URL", {
              timestamp: new Date().toISOString(),
              streamUrl: streamUrl.substring(0, 100) + (streamUrl.length > 100 ? '...' : ''),
              streamTrack: dialBody.stream_track,
              hasToken: streamUrl.includes('token='),
            });
          } else {
            console.warn("[TELEMETRY] callAssistantAction - No streamUrl provided", {
              timestamp: new Date().toISOString(),
            });
          }

          console.log("[TELEMETRY] callAssistantAction - Dialing call", {
            timestamp: new Date().toISOString(),
            dialBody: {
              ...dialBody,
              to: dialBody.to ? `***${dialBody.to.slice(-4)}` : 'missing',
              from: dialBody.from ? `***${dialBody.from.slice(-4)}` : 'missing',
            },
          });

          const dialResponse = await transport.request("/calls", {
            method: "POST",
            body: dialBody,
          });
          
          console.log("[TELEMETRY] callAssistantAction - Dial response received", {
            timestamp: new Date().toISOString(),
            hasResponse: !!dialResponse,
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

    let tenantId: string | null = null;
    try {
      tenantId = await ensureTenantId().catch(() => null);
    } catch {
      tenantId = null;
    }

    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3010";
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    const webhookUrlBase = `${baseUrl}/api/webhooks/telnyx/call-events`;
    const webhookUrlWithTenant = tenantId
      ? `${webhookUrlBase}?tenantId=${tenantId}`
      : `${webhookUrlBase}?tenantId=YOUR_TENANT_ID`;

    return {
      assistantId,
      webhookUrl: webhookUrlBase,
      webhookUrlWithTenant,
      tenantId,
      tenantHeader: "x-tenant-id",
      tenantQueryParam: "tenantId",
      requiredEnv: [
        // For webhook verification (Voice API v2).
        "TELNYX_PUBLIC_KEY",
        // For Call Control commands if not using per-tenant integration config.
        "TELNYX_API_KEY",
        // For decrypting integration credentials if encryption is enabled.
        "INTEGRATION_CREDENTIALS_KEY",
        // For storing webhook events.
        "SUPABASE_SERVICE_ROLE_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
      ],
      localTunnelNotes: [
        "Telnyx must reach your webhook over the public internet (localhost won't work).",
        "If testing locally, use a tunnel (ngrok) and paste the HTTPS URL above into the Telnyx Voice API Application.",
        "ngrok setup: `ngrok config add-authtoken <token>` then `ngrok http 3010`.",
      ],
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
