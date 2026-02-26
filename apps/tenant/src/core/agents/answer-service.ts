import "server-only";

import { createAdminClient } from "@/core/database/admin-client";
import { getAgentInstanceById, getAgentInstanceByPublicKey } from "./registry";
import { routeAgentChat } from "./router";
import { detectTieredIntent, isTieredResetCommand } from "./tiered-intent";
import type { AgentChatResponse } from "./types";
import type {
  AnswerRequest,
  AnswerResponse,
  AnswerCitation,
  ProductRecommendation,
} from "./answer-types";

const TIERED_ESCALATION_CONFIDENCE_THRESHOLD = 0.7;
const TIERED_LEVEL2_BANNER = "Connecting to Action Assistant…";
const TIERED_LEVEL3_BANNER = "Connecting to Strategic Assistant…";
const DEFAULT_RESET_IDLE_MINUTES = 30;
const DEFAULT_LEVEL2_UNAVAILABLE_MESSAGE =
  "I can help with general info, but booking is temporarily unavailable. Please try again later or contact support.";
const DEFAULT_LEVEL3_UNAVAILABLE_MESSAGE =
  "I can help with general info, but strategic assistance is temporarily unavailable. Please try again later or contact support.";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function getEntryAgent(request: AnswerRequest) {
  if (request.publicKey?.trim()) {
    return getAgentInstanceByPublicKey(request.publicKey.trim());
  }
  if (request.agentId?.trim() && request.tenantId?.trim()) {
    return getAgentInstanceById(request.tenantId.trim(), request.agentId.trim());
  }
  return null;
}

async function getConversationState(tenantId: string, conversationId: string) {
  const admin = createAdminClient();
  const { data: convo } = await (admin.from("chatbot_conversations") as any)
    .select("id, metadata, updated_at")
    .eq("tenant_id", tenantId)
    .eq("id", conversationId)
    .maybeSingle();

  if (!convo) return null;

  const { data: lastMessage } = await (admin.from("chatbot_messages") as any)
    .select("created_at")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastActivityAt =
    asTrimmedString(lastMessage?.created_at) ?? asTrimmedString(convo.updated_at);

  return {
    metadata: asRecord(convo.metadata),
    lastActivityAt,
  };
}

async function updateConversationMetadata(args: {
  tenantId: string;
  conversationId: string;
  metadata: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await (admin.from("chatbot_conversations") as any)
    .update({
      metadata: args.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", args.tenantId)
    .eq("id", args.conversationId);
}

async function logTieredWarning(args: {
  tenantId: string;
  level: 2 | 3;
  reason: string;
  conversationId?: string;
  entryAgentId: string;
}) {
  try {
    const admin = createAdminClient();
    await (admin.from("ai_agent_events") as any).insert({
      tenant_id: args.tenantId,
      provider: "tiered_orchestration",
      event_type: "agent.tiered_escalation_skipped",
      payload: {
        reason: args.reason,
        level: args.level,
        conversation_id: args.conversationId ?? null,
        entry_agent_id: args.entryAgentId,
      },
    });
  } catch (error) {
    console.warn("[TieredOrchestration] Failed to emit warning event", error);
  }
}

function buildAnswerResponse(
  request: AnswerRequest,
  chatResponse: AgentChatResponse,
  tieredEscalationBanner?: string
): AnswerResponse {
  const citations = extractCitations(chatResponse.usage?.metadata);
  const recommendations = extractProductRecommendations(
    request.message,
    chatResponse.message,
    chatResponse.usage?.metadata
  );

  return {
    agentId: chatResponse.agentId,
    provider: chatResponse.provider,
    conversationId: chatResponse.conversationId,
    externalConversationId: chatResponse.externalConversationId,
    voice_text: toVoiceText(chatResponse.message),
    chat_markdown: toChatMarkdown(chatResponse.message, citations),
    citations,
    product_recommendations: recommendations,
    handoffSuggested: chatResponse.handoffSuggested ?? false,
    handoffReason: chatResponse.handoffReason,
    tieredEscalationBanner,
    toolResults: undefined,
    usage: chatResponse.usage,
  };
}

/**
 * Condense a full answer into a concise, speakable voice response.
 * Strips markdown, links, and long lists; keeps the first 2-3 sentences.
 */
function toVoiceText(content: string): string {
  let text = content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`#>]/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 3) {
    text = sentences.slice(0, 3).join(" ").trim();
  }

  if (text.length > 500) {
    text = text.slice(0, 497).replace(/\s+\S*$/, "") + "...";
  }

  return text;
}

/**
 * Enrich a plain answer into chat-friendly markdown.
 * If the provider already returns markdown, pass through.
 * Add citation footnotes when available.
 */
function toChatMarkdown(
  content: string,
  citations: AnswerCitation[]
): string {
  let md = content;

  if (citations.length > 0) {
    md += "\n\n---\n**Sources:**\n";
    for (const [i, c] of citations.entries()) {
      const link = c.url ? `[${c.title}](${c.url})` : c.title;
      md += `${i + 1}. ${link}\n`;
    }
  }

  return md;
}

/**
 * Extract citations from the raw provider response when available.
 * The advanced (RAG) provider returns citations in raw.citations;
 * other providers may not.
 */
function extractCitations(raw: unknown): AnswerCitation[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;

  const rawCitations = obj.citations as
    | Array<Record<string, unknown>>
    | undefined;
  if (!Array.isArray(rawCitations)) return [];

  return rawCitations
    .filter((c) => c && typeof c.title === "string")
    .map((c) => ({
      title: String(c.title),
      source: String(c.source ?? ""),
      documentId: c.documentId ? String(c.documentId) : undefined,
      url: c.url ? String(c.url) : undefined,
    }));
}

/**
 * Placeholder product recommendation extraction.
 * In the future this will call a retrieval service against a product catalog.
 * For now it returns an empty array.
 */
function extractProductRecommendations(
  _message: string,
  _content: string,
  _raw: unknown
): ProductRecommendation[] {
  return [];
}

/**
 * Unified Answer API: routes through the agent provider layer and produces
 * dual-format output (voice_text + chat_markdown) from the same knowledge source.
 */
export async function getAgentAnswer(
  request: AnswerRequest
): Promise<AnswerResponse> {
  const baseMetadata = {
    ...(request.metadata ?? {}),
    externalConversationId: request.externalConversationId,
    answerApiChannel: request.channel,
    context: request.context,
  };

  const entryAgent = await getEntryAgent(request);
  if (!entryAgent || !asBoolean(entryAgent.routing?.tieredChat)) {
    const chatResponse: AgentChatResponse = await routeAgentChat({
      tenantId: request.tenantId ?? "",
      agentId: request.agentId,
      publicKey: request.publicKey,
      message: request.message,
      conversationId: request.conversationId,
      channel: request.channel,
      userId: request.userId,
      metadata: baseMetadata,
    });
    return buildAnswerResponse(request, chatResponse);
  }

  const tenantId = entryAgent.tenant_id;
  const routing = asRecord(entryAgent.routing);
  const level1AgentId = asTrimmedString(routing.level1AgentId) ?? entryAgent.id;
  const level2AgentId = asTrimmedString(routing.level2AgentId);
  const level3AgentId = asTrimmedString(routing.level3AgentId);
  const safeFallbackMessage =
    asTrimmedString(routing.tieredFallbackMessageUnavailable) ?? undefined;
  const resetIdleMinutes = asNumber(
    routing.tieredResetIdleMinutes,
    DEFAULT_RESET_IDLE_MINUTES
  );

  let existingEscalatedAgentId: string | undefined;
  let existingConversationMetadata: Record<string, unknown> | undefined;
  if (request.conversationId) {
    const state = await getConversationState(tenantId, request.conversationId);
    if (state) {
      existingConversationMetadata = state.metadata;
      existingEscalatedAgentId = asTrimmedString(
        state.metadata.tiered_escalated_to_agent_id
      );

      const resetByCommand = isTieredResetCommand(request.message);
      const resetByTimeout = Boolean(
        state.lastActivityAt &&
          Date.now() - new Date(state.lastActivityAt).getTime() >
            resetIdleMinutes * 60 * 1000
      );

      if ((resetByCommand || resetByTimeout) && existingEscalatedAgentId) {
        const nextMetadata = { ...state.metadata };
        delete nextMetadata.tiered_escalated_to_agent_id;
        delete nextMetadata.tiered_escalated_at;
        await updateConversationMetadata({
          tenantId,
          conversationId: request.conversationId,
          metadata: nextMetadata,
        });
        existingEscalatedAgentId = undefined;
        existingConversationMetadata = nextMetadata;
      }
    }
  }

  if (existingEscalatedAgentId) {
    const escalatedResponse: AgentChatResponse = await routeAgentChat({
      tenantId,
      agentId: existingEscalatedAgentId,
      message: request.message,
      conversationId: request.conversationId,
      channel: request.channel,
      userId: request.userId,
      metadata: {
        ...baseMetadata,
        tieredEscalationSource: "existing",
      },
    });
    return buildAnswerResponse(request, escalatedResponse);
  }

  const l1Response: AgentChatResponse = await routeAgentChat({
    tenantId,
    agentId: level1AgentId,
    message: request.message,
    conversationId: request.conversationId,
    channel: request.channel,
    userId: request.userId,
    metadata: {
      ...baseMetadata,
      tieredEscalationSource: "level1",
    },
  });

  const intent = detectTieredIntent(request.message, l1Response.message);
  if (!intent.escalate || intent.confidence < TIERED_ESCALATION_CONFIDENCE_THRESHOLD) {
    return buildAnswerResponse(request, l1Response);
  }

  const targetAgentId = intent.level === 2 ? level2AgentId : level3AgentId;
  if (!targetAgentId) {
    await logTieredWarning({
      tenantId,
      level: intent.level,
      reason: "missing_target_agent",
      conversationId: l1Response.conversationId,
      entryAgentId: entryAgent.id,
    });

    const safeMessage =
      safeFallbackMessage ??
      (intent.level === 2
        ? DEFAULT_LEVEL2_UNAVAILABLE_MESSAGE
        : DEFAULT_LEVEL3_UNAVAILABLE_MESSAGE);

    return buildAnswerResponse(request, {
      ...l1Response,
      message: safeMessage,
    });
  }

  const escalatedResponse: AgentChatResponse = await routeAgentChat({
    tenantId,
    agentId: targetAgentId,
    message: request.message,
    conversationId: l1Response.conversationId,
    channel: request.channel,
    userId: request.userId,
    metadata: {
      ...baseMetadata,
      tieredEscalationSource: "this_turn",
      tieredEscalationLevel: intent.level,
      tieredEscalationConfidence: intent.confidence,
    },
  });

  const conversationId = escalatedResponse.conversationId;
  const stateAfterEscalation =
    (await getConversationState(tenantId, conversationId)) ??
    ({
      metadata: existingConversationMetadata ?? {},
    } as {
      metadata: Record<string, unknown>;
      lastActivityAt?: string;
    });

  await updateConversationMetadata({
    tenantId,
    conversationId,
    metadata: {
      ...stateAfterEscalation.metadata,
      tiered_escalated_to_agent_id: targetAgentId,
      tiered_escalated_at: new Date().toISOString(),
    },
  });

  const banner =
    intent.level === 2 ? TIERED_LEVEL2_BANNER : TIERED_LEVEL3_BANNER;
  return buildAnswerResponse(request, escalatedResponse, banner);
}
