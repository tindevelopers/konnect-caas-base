"use server";

import {
  cloneAssistant,
  createAssistant,
  deleteAssistant,
  getAssistant,
  importAssistants,
  listAssistants,
  TelnyxApiError,
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
import { getTelnyxTransport, getTelnyxTransportWithSource } from "./client";
import { trackApiCall } from "@/src/core/telemetry";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { createClient } from "@/core/database/server";
import { createAdminClient } from "@/core/database/admin-client";

const TELNYX_PROVIDER = "telnyx";

/**
 * Register a Telnyx assistant ID in the tenant_ai_assistants mapping table.
 * Only used when the tenant is on a shared Telnyx account (non-enterprise).
 */
async function registerAssistantMapping(
  tenantId: string,
  telnyxAssistantId: string,
  userId?: string | null
): Promise<void> {
  try {
    const adminClient = createAdminClient();
    await adminClient
      .from("tenant_ai_assistants" as any)
      .upsert(
        {
          tenant_id: tenantId,
          telnyx_assistant_id: telnyxAssistantId,
          created_by: userId || null,
        } as any,
        { onConflict: "tenant_id,telnyx_assistant_id" }
      );
  } catch (err) {
    console.error("[registerAssistantMapping] Failed to register mapping:", err);
  }
}

/**
 * Remove a Telnyx assistant ID from the tenant_ai_assistants mapping table.
 */
async function removeAssistantMapping(
  tenantId: string,
  telnyxAssistantId: string
): Promise<void> {
  try {
    const adminClient = createAdminClient();
    await adminClient
      .from("tenant_ai_assistants" as any)
      .delete()
      .eq("tenant_id", tenantId)
      .eq("telnyx_assistant_id", telnyxAssistantId);
  } catch (err) {
    console.error("[removeAssistantMapping] Failed to remove mapping:", err);
  }
}

/**
 * Get the set of Telnyx assistant IDs mapped to a tenant.
 * Returns null if tenant is not on a shared account (enterprise tenants skip filtering).
 */
async function getTenantAssistantIds(tenantId: string): Promise<Set<string>> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("tenant_ai_assistants" as any)
    .select("telnyx_assistant_id")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[getTenantAssistantIds] Error:", error);
    return new Set();
  }

  return new Set(
    (data as { telnyx_assistant_id: string }[]).map((r) => r.telnyx_assistant_id)
  );
}

function extractTelnyxErrorDetail(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  if (typeof d.message === "string" && d.message.trim()) return d.message.trim();
  const errors = d.errors;
  if (Array.isArray(errors) && errors.length) {
    const parts: string[] = [];
    for (const err of errors.slice(0, 3)) {
      if (err && typeof err === "object") {
        const e = err as Record<string, unknown>;
        const title = typeof e.title === "string" ? e.title.trim() : "";
        const detail = typeof e.detail === "string" ? e.detail.trim() : "";
        const code = typeof e.code === "string" ? e.code.trim() : "";
        const part = [code && `(${code})`, title, detail].filter(Boolean).join(" ");
        if (part) parts.push(part);
      }
    }
    if (parts.length) return parts.join("; ");
  }
  if (typeof d.detail === "string" && d.detail.trim()) return d.detail.trim();
  return null;
}

/**
 * Normalize a phone number to E.164 format (+ followed by digits only).
 * Strips spaces, dashes, parentheses; adds + if missing.
 */
function normalizeToE164(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.length === 0) return raw.trim();
  return raw.trim().startsWith("+") ? `+${digitsOnly}` : `+${digitsOnly}`;
}

/** E.164: + followed by 10–15 digits. */
const E164_REGEX = /^\+\d{10,15}$/;

function validateE164(value: string, param: "to" | "from"): string {
  const normalized = normalizeToE164(value);
  if (!E164_REGEX.test(normalized)) {
    throw new Error(
      `Phone number must be in E.164 format (e.g. +15551234567). The "${param}" value you entered is not valid.`
    );
  }
  return normalized;
}

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
    const { transport, credentialSource } = await getTelnyxTransportWithSource("integrations.read");

    return trackApiCall(
      "listAssistants",
      TELNYX_PROVIDER,
      async () => {
        const response = await listAssistants(transport);

        // Enterprise tenants (own Telnyx account) see all their assistants — no filter
        if (credentialSource === "tenant") {
          return response;
        }

        // Shared account: filter by tenant_ai_assistants mapping
        if (tenantId && credentialSource === "shared") {
          const allowedIds = await getTenantAssistantIds(tenantId);
          const allAssistants = response.data ?? [];
          return {
            ...response,
            data: allAssistants.filter((a: { id: string }) => allowedIds.has(a.id)),
          };
        }

        // Platform Admin with no tenant selected on shared account — show all
        return response;
      },
      { tenantId, userId }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[listAssistantsAction] caught:", errMsg);
    let userMessage =
      "Unable to load assistants. Please check your agent integration (API key and tenant) and try again.";
    if (error instanceof Error) {
      if (error.message.includes("Permission denied") || error.message.includes("Insufficient tenant permissions")) {
        userMessage =
          "You don't have permission to view integrations. Contact your Organization Admin to get access to AI Assistants.";
      } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        userMessage =
          "Provider API authentication failed (401). Please verify your API key in System Admin → Integrations → Telephony.";
      } else if (error.message.includes("Tenant context missing")) {
        userMessage =
          "Tenant context missing. Please select a tenant or configure the platform default telephony integration.";
      } else if (error.message.includes("not configured") || error.message.includes("API key")) {
        userMessage =
          "Telephony API key not configured. Configure in System Admin → Integrations or set your environment key.";
      } else if (
        /INTEGRATION_CREDENTIALS_KEY|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_SUPABASE/i.test(error.message)
      ) {
        userMessage =
          "Telephony API key not configured. Set the key in your environment or configure integration credentials on the server.";
      }
    }
    return { error: userMessage };
  }
}

/** List tenant-scoped assistants for voice routing dropdown (id + name only). */
export async function listTenantAssistantsForVoiceAction(): Promise<
  { data: Array<{ id: string; name: string }> } | { error: string }
> {
  const result = await listAssistantsAction();
  if ("error" in result && result.error) {
    return { data: [], error: result.error };
  }
  const list = (result as { data?: Array<{ id: string; name?: string }> }).data ?? [];
  return {
    data: list.map((a) => ({ id: a.id, name: (a.name ?? a.id).trim() || a.id })),
  };
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
  const { transport, credentialSource } = await getTelnyxTransportWithSource("integrations.write");
  
  return trackApiCall(
    "createAssistant",
    TELNYX_PROVIDER,
    async () => {
      const result = await createAssistant(transport, payload);
      const assistantId = result?.id ?? (result as any)?.data?.id;

      // Register mapping for non-enterprise tenants (shared Telnyx account)
      if (credentialSource === "shared" && tenantId && assistantId) {
        await registerAssistantMapping(tenantId, assistantId, userId);
      }

      return result;
    },
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
  const { transport, credentialSource } = await getTelnyxTransportWithSource("integrations.write");

  return trackApiCall(
    "cloneAssistant",
    TELNYX_PROVIDER,
    async () => {
      const response = await cloneAssistant(transport, assistantId);
      const clonedId = response?.id ?? (response as { data?: { id?: string } })?.data?.id;
      if (!clonedId) {
        throw new Error("Clone succeeded but no assistant ID was returned.");
      }

      // Register mapping for non-enterprise tenants (shared Telnyx account)
      if (credentialSource === "shared" && tenantId) {
        await registerAssistantMapping(tenantId, clonedId, userId);
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
  const { transport, credentialSource } = await getTelnyxTransportWithSource("integrations.write");
  
  return trackApiCall(
    "deleteAssistant",
    TELNYX_PROVIDER,
    async () => {
      await deleteAssistant(transport, assistantId);

      // Clean up mapping for non-enterprise tenants (shared Telnyx account)
      if (credentialSource === "shared" && tenantId) {
        await removeAssistantMapping(tenantId, assistantId);
      }
    },
    {
      tenantId,
      userId,
      requestData: { assistantId },
    }
  );
}

export async function importAssistantsAction(payload: TelnyxImportAssistantsRequest) {
  const { tenantId, userId } = await getTelemetryContext();
  const { transport, credentialSource } = await getTelnyxTransportWithSource("integrations.write");
  
  return trackApiCall(
    "importAssistants",
    TELNYX_PROVIDER,
    async () => {
      const result = await importAssistants(transport, payload);

      // Register mappings for non-enterprise tenants (shared Telnyx account)
      if (credentialSource === "shared" && tenantId) {
        const imported = result?.data ?? [];
        for (const item of imported) {
          const assistantId = (item as { id?: string }).id;
          if (assistantId) {
            await registerAssistantMapping(tenantId, assistantId, userId);
          }
        }
      }

      return result;
    },
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
            "Tenant context missing. Please select a tenant or configure the platform default telephony integration."
          );
        }
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          throw new Error(
            "Provider API authentication failed (401). Please verify your API key is valid. " +
            "Check your API key in System Admin → Integrations → Telephony"
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
          // Normalize and validate E.164 for Telnyx
          const toE164 = validateE164(toNumber, "to");
          const fromE164 = validateE164(fromNumber, "from");

          // Build dial request body
          const dialBody: Record<string, string> = {
            connection_id: connectionId.trim(),
            from: fromE164,
            to: toE164,
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
              `Provider dial did not return a call_control_id. Response: ${responseStr.substring(0, 500)}`
            );
          }

          // Telnyx requires the call to be answered before ai_assistant_start. Attach
          // assistant_id and tenant_id to the call via client_state so the webhook can
          // start the assistant on call.answered.
          if (tenantId) {
            const statePayload = { t: "tinadmin_outbound_assistant", a: assistantId, tid: tenantId };
            const clientState = Buffer.from(JSON.stringify(statePayload), "utf8").toString("base64");
            try {
              await transport.request(
                `/calls/${callControlId}/actions/client_state_update`,
                { method: "PUT", body: { client_state: clientState } }
              );
            } catch (stateErr) {
              console.warn("[callAssistantAction] client_state_update failed (call will still ring):", stateErr);
            }
          }

          // Return immediately; assistant will be started by webhook when call is answered.
          return { callControlId, conversationId: null };
        } catch (error) {
          // Surface Telnyx API error details for better debugging
          if (error instanceof TelnyxApiError) {
            if (error.status === 404) {
              throw new Error(
                "Call Control App ID not found. Please verify the Connection ID is correct in your provider console."
              );
            }
            if (error.status === 400) {
              throw new Error(
                "Invalid request parameters. Please check phone numbers and Call Control App ID format."
              );
            }
            if (error.status === 422) {
              const telnyxDetail = extractTelnyxErrorDetail(error.details);
              const hint =
                "Invalid assistant configuration. Please verify the assistant ID exists and is properly configured.";
              throw new Error(
                telnyxDetail ? `${hint} Telnyx: ${telnyxDetail}` : hint
              );
            }
          }
          if (error instanceof Error) {
            if (error.message.includes("404")) {
              throw new Error(
                "Call Control App ID not found. Please verify the Connection ID is correct in your provider console."
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
          "Tenant context missing. Please select a tenant or configure the platform default telephony integration."
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
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3020";
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
        "Provider webhook public key (for signature verification)",
        "Provider API key (for Call Control commands if not using per-tenant integration config)",
        "Integration credentials encryption key (if encryption is enabled)",
        "Database service role key (for storing webhook events)",
        "Database URL (for storing webhook events)",
      ],
      localTunnelNotes: [
        "Your provider must reach your webhook over the public internet (localhost won't work).",
        "If testing locally, use a tunnel (ngrok) and paste the HTTPS URL above into your provider Voice API Application.",
        "ngrok setup: `ngrok config add-authtoken <token>` then `ngrok http 3020`.",
      ],
      steps: [
        "Create or open your Call Control App in your provider console.",
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
        // Verify the assistant exists
        await getAssistant(transport, assistantId);

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

        // Trigger the test run. Do not pass destination_version_id: Telnyx will use the
        // assistant's main version. Passing a stale or invalid version_id causes 400
        // "Assistant version with id ... does not exist".
        const testRun = await triggerAssistantTestRun(transport, testId, {});
        
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
          "Provider API authentication failed (401). Please verify your API key is valid. " +
          "Check your API key in System Admin → Integrations → Telephony"
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
