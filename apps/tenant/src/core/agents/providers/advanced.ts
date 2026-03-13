import "server-only";

import { processChatMessage } from "@/core/chatbot";
import { createAdminClient } from "@/core/database/admin-client";
import type { AgentProviderDriver } from "./base";
import type { AgentProviderRequest, AgentProviderResponse } from "../types";

const HANDOFF_KEYWORDS = ["human", "live agent", "representative", "manager"];
const SCHEDULING_KEYWORDS = ["book", "appointment", "schedule", "reschedule"];

function includesAnyKeyword(message: string, keywords: string[]) {
  const normalized = message.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function runSyntheticToolHints(message: string): Array<Record<string, unknown>> {
  const hints: Array<Record<string, unknown>> = [];
  if (includesAnyKeyword(message, SCHEDULING_KEYWORDS)) {
    hints.push({
      tool: "scheduling_lookup",
      status: "suggested",
      providers: ["google-calendar", "cal.com", "nylas"],
      note: "Detected scheduling intent. Route to enabled calendar provider.",
    });
  }

  if (message.toLowerCase().includes("ticket")) {
    hints.push({
      tool: "support_ticket_context",
      status: "suggested",
      note: "Detected support context. Attach recent ticket history.",
    });
  }

  return hints;
}

async function lookupMcpHints(
  tenantId: string,
  message: string
): Promise<Array<Record<string, unknown>>> {
  const normalized = message.toLowerCase();
  if (!normalized.includes("mcp") && !normalized.includes("tool")) return [];

  const admin = createAdminClient();
  const { data } = await (admin.from("telnyx_mcp_servers") as any)
    .select("id,name,url,type")
    .eq("tenant_id", tenantId)
    .limit(5);

  if (!data || data.length === 0) return [];
  return (data as Array<Record<string, unknown>>).map((server) => ({
    tool: "mcp_server",
    status: "available",
    server_id: server.id,
    name: server.name,
    type: server.type,
    url: server.url,
  }));
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function extractString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveHandoffTargetAgentId(
  routing: Record<string, unknown>
): string | undefined {
  const defaultId = extractString(routing.defaultHandoffAgentId);
  if (defaultId) return defaultId;

  const targets = routing.handoffTargets;
  if (!Array.isArray(targets)) return undefined;
  for (const target of targets) {
    if (!target || typeof target !== "object") continue;
    const id = extractString((target as Record<string, unknown>).agentId);
    if (id) return id;
  }
  return undefined;
}

function estimateModelCost(inputTokens: number, outputTokens: number, model?: string) {
  const normalized = (model ?? "").toLowerCase();
  if (normalized.includes("mini") || normalized.includes("haiku")) {
    // Very-low-cost profile.
    return inputTokens * 0.0000002 + outputTokens * 0.0000008;
  }
  // Default mid/high profile (rough GPT-4o-like baseline).
  return inputTokens * 0.0000025 + outputTokens * 0.00001;
}

export class AdvancedAgentProvider implements AgentProviderDriver {
  readonly name = "advanced";

  async sendMessage(
    request: AgentProviderRequest
  ): Promise<AgentProviderResponse> {
    const response = await processChatMessage(
      {
        message: request.message,
        conversationId: request.conversationId,
        tenantId: request.tenantId,
        userId: request.userId,
        context: {
          agentId: request.agent.id,
          channel: request.channel,
          metadata: request.metadata ?? {},
        },
      },
      {
        tenantId: request.tenantId,
        userId: request.userId,
        conversationId: request.conversationId,
      }
    );

    const toolResults = [
      ...runSyntheticToolHints(request.message),
      ...(await lookupMcpHints(request.tenantId, request.message)),
    ];
    const handoffSuggested = includesAnyKeyword(request.message, HANDOFF_KEYWORDS);
    const handoffReason = handoffSuggested
      ? "User requested escalation to a human."
      : undefined;
    const handoffTargetAgentId = handoffSuggested
      ? resolveHandoffTargetAgentId(request.agent.routing ?? {})
      : undefined;
    const inputTokens = estimateTokenCount(request.message);
    const outputTokens = estimateTokenCount(response.message);
    const model = request.agent.model_profile?.model as string | undefined;
    const estimatedCost = estimateModelCost(inputTokens, outputTokens, model);

    return {
      content: response.message,
      conversationId: response.conversationId,
      usage: {
        inputTokens,
        outputTokens,
        toolCalls: toolResults.length,
        estimatedCost,
        currency: "USD",
      },
      handoffSuggested,
      handoffReason,
      handoffTargetAgentId,
      toolResults,
      raw: response.metadata ?? {},
    };
  }
}

