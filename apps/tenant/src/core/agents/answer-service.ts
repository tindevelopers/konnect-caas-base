import "server-only";

import { randomUUID } from "crypto";
import { createAdminClient } from "@/core/database/admin-client";
import { getAgentInstanceById, getAgentInstanceByPublicKey } from "./registry";
import {
  ensureConversation,
  persistConversationMessages,
  routeAgentChat,
} from "./router";
import { detectTieredIntent, isTieredResetCommand } from "./tiered-intent";
import { getTelnyxTransportForWebhook } from "@/src/core/telnyx/webhook-transport";
import type { AgentChatResponse, AgentInstance } from "./types";
import type {
  AnswerRequest,
  AnswerResponse,
  AnswerCitation,
  ProductRecommendation,
} from "./answer-types";

const TIERED_ESCALATION_CONFIDENCE_THRESHOLD = 0.7;
const TIERED_LEVEL2_BANNER = "Connecting to Strategic Assistant…";
const DEFAULT_RESET_IDLE_MINUTES = 30;
const DEFAULT_L2_UNAVAILABLE_MESSAGE =
  "I can help with general info, but strategic assistance is temporarily unavailable. Please try again later or contact support.";
const DEFAULT_L1_FAILURE_MESSAGE =
  "I'm having trouble right now. Please try again in a moment.";
const DEFAULT_L1_TIMEOUT_MS = 15000;

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

function asTimeoutMs(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n * 1000) : fallback;
}

async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

type TelnyxDirectChatResponse = {
  content?: string;
  conversation_id?: string;
  data?: {
    content?: string;
    conversation_id?: string;
  };
};

function extractTelnyxContent(response: TelnyxDirectChatResponse): string {
  if (typeof response.content === "string" && response.content.trim()) {
    return response.content;
  }
  if (
    response.data &&
    typeof response.data.content === "string" &&
    response.data.content.trim()
  ) {
    return response.data.content;
  }
  return "I was unable to generate a response at the moment.";
}

function extractTelnyxConversationId(
  response: TelnyxDirectChatResponse
): string | undefined {
  if (
    typeof response.conversation_id === "string" &&
    response.conversation_id.trim()
  ) {
    return response.conversation_id;
  }
  if (
    response.data &&
    typeof response.data.conversation_id === "string" &&
    response.data.conversation_id.trim()
  ) {
    return response.data.conversation_id;
  }
  return undefined;
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
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

async function markConversationEscalated(args: {
  tenantId: string;
  conversationId?: string;
  targetAgentId: string;
  existingMetadata?: Record<string, unknown>;
}) {
  if (!args.conversationId) return;
  const stateAfterEscalation =
    (await getConversationState(args.tenantId, args.conversationId)) ??
    ({
      metadata: args.existingMetadata ?? {},
    } as {
      metadata: Record<string, unknown>;
      lastActivityAt?: string;
    });

  await updateConversationMetadata({
    tenantId: args.tenantId,
    conversationId: args.conversationId,
    metadata: {
      ...stateAfterEscalation.metadata,
      tiered_escalated_to_agent_id: args.targetAgentId,
      tiered_escalated_at: new Date().toISOString(),
    },
  });
}

async function logTieredWarning(args: {
  tenantId: string;
  level: 2;
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

async function getDirectTelnyxL1Response(args: {
  tenantId: string;
  entryAgent: AgentInstance;
  assistantId: string;
  message: string;
  conversationId?: string;
  providerConversationId?: string;
  channel?: string;
  timeoutMs: number;
}) {
  const { transport } = await getTelnyxTransportForWebhook(args.tenantId);
  const providedConversationId = args.providerConversationId?.trim();
  let providerConversationId = providedConversationId ?? randomUUID();

  const requestBodyBase: Record<string, unknown> = {
    content: args.message,
  };
  const requestBodyWithConversation: Record<string, unknown> = {
    ...requestBodyBase,
    conversation_id: providerConversationId,
  };

  let telnyxResponse: TelnyxDirectChatResponse;
  try {
    telnyxResponse = await withTimeout(
      transport.request<TelnyxDirectChatResponse>(
        `/ai/assistants/${args.assistantId}/chat`,
        {
          method: "POST",
          body: requestBodyWithConversation,
        }
      ),
      args.timeoutMs,
      "Telnyx L1 request timed out"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isConversationNotFound =
      /10005|Resource not found|Error fetching conversation/i.test(message);

    // If provider rejected a conversation_id, retry once with a fresh one.
    if (isConversationNotFound) {
      providerConversationId = randomUUID();
      telnyxResponse = await withTimeout(
        transport.request<TelnyxDirectChatResponse>(
          `/ai/assistants/${args.assistantId}/chat`,
          {
            method: "POST",
            body: {
              ...requestBodyBase,
              conversation_id: providerConversationId,
            },
          }
        ),
        args.timeoutMs,
        "Telnyx L1 retry with fresh conversation_id timed out"
      );
    } else {
      throw error;
    }
  }

  const l1Message = extractTelnyxContent(telnyxResponse);
  const resolvedProviderConversationId =
    extractTelnyxConversationId(telnyxResponse) ?? providerConversationId;
  const conversationId = await ensureConversation({
    tenantId: args.tenantId,
    conversationId: args.conversationId,
    agent: args.entryAgent,
    channel: args.channel,
    providerConversationId: resolvedProviderConversationId,
  });
  await persistConversationMessages({
    tenantId: args.tenantId,
    conversationId,
    userMessage: args.message,
    assistantMessage: l1Message,
    agent: args.entryAgent,
    channel: args.channel,
    providerConversationId: resolvedProviderConversationId,
  });
  return {
    agentId: args.entryAgent.id,
    provider: "telnyx",
    message: l1Message,
    conversationId,
    externalConversationId: resolvedProviderConversationId,
    usage: {
      channel: args.channel ?? "webchat",
      provider: "telnyx",
      event_type: "agent.chat.completed",
      input_tokens: estimateTokenCount(args.message),
      output_tokens: estimateTokenCount(l1Message),
      tool_calls: 0,
      estimated_cost:
        estimateTokenCount(args.message) * 0.0000025 +
        estimateTokenCount(l1Message) * 0.00001,
      currency: "USD",
      metadata: {
        source: "tiered_direct_telnyx_l1",
      },
    },
  } as AgentChatResponse;
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

  // #region agent log
  fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "answer-service.ts:getEntryAgent",
      message: "Entry agent lookup",
      data: {
        entryAgentId: entryAgent?.id ?? null,
        tieredChat: entryAgent ? asBoolean(entryAgent.routing?.tieredChat) : null,
        provider: entryAgent?.provider ?? null,
      },
      timestamp: Date.now(),
      hypothesisId: "H1",
    }),
  }).catch(() => {});
  // #endregion

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
  const level2AgentId = asTrimmedString(routing.level2AgentId);
  const safeFallbackMessage =
    asTrimmedString(routing.tieredFallbackMessageUnavailable) ?? undefined;
  const safeL1FailureMessage =
    asTrimmedString(routing.tieredL1FailureMessage) ?? DEFAULT_L1_FAILURE_MESSAGE;
  const resetIdleMinutes = asNumber(
    routing.tieredResetIdleMinutes,
    DEFAULT_RESET_IDLE_MINUTES
  );
  const l1TimeoutMs = asTimeoutMs(routing.tieredL1TimeoutSeconds, DEFAULT_L1_TIMEOUT_MS);
  const isProxyBrain =
    (baseMetadata as Record<string, unknown>).telnyx_proxy_brain === true;
  const proxyAssistantId = asTrimmedString(
    (baseMetadata as Record<string, unknown>).telnyx_proxy_assistant_id
  );
  const proxyDelegateAgentId = asTrimmedString(routing.proxyBrainDelegateAgentId);

  // Transport-only mode: Telnyx does transport/delivery only; all processing goes to the delegate (e.g. Abacus).
  if (isProxyBrain && proxyDelegateAgentId) {
    const chatResponse = await routeAgentChat({
      tenantId,
      agentId: proxyDelegateAgentId,
      message: request.message,
      conversationId: request.conversationId,
      channel: request.channel,
      userId: request.userId,
      metadata: {
        ...baseMetadata,
        tieredEscalationSource: "proxy_delegate",
      },
    });
    return buildAnswerResponse(request, chatResponse);
  }

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
    try {
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
    } catch (error) {
      console.error("[TieredOrchestration] Existing L2 routing failed", error);
      return buildAnswerResponse(request, {
        agentId: entryAgent.id,
        provider: entryAgent.provider,
        conversationId: request.conversationId ?? "",
        externalConversationId: request.externalConversationId,
        message: safeFallbackMessage ?? DEFAULT_L2_UNAVAILABLE_MESSAGE,
      });
    }
  }

  let l1Response: AgentChatResponse;
  try {
    if (isProxyBrain && proxyAssistantId) {
      l1Response = await getDirectTelnyxL1Response({
        tenantId,
        entryAgent,
        assistantId: proxyAssistantId,
        message: request.message,
        conversationId: request.conversationId,
        providerConversationId:
          request.externalConversationId ?? asTrimmedString(baseMetadata.externalConversationId),
        channel: request.channel,
        timeoutMs: l1TimeoutMs,
      });
    } else {
      l1Response = await routeAgentChat({
        tenantId,
        agentId: entryAgent.id,
        message: request.message,
        conversationId: request.conversationId,
        channel: request.channel,
        userId: request.userId,
        metadata: {
          ...baseMetadata,
          tieredEscalationSource: "level1",
        },
      });
    }
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "answer-service.ts:L1catch",
        message: "L1 routing failed",
        data: {
          error: error instanceof Error ? error.message : String(error),
          provider: entryAgent.provider,
          isProxyBrain,
          proxyAssistantId: proxyAssistantId ?? null,
        },
        timestamp: Date.now(),
        hypothesisId: "H4",
      }),
    }).catch(() => {});
    // #endregion
    console.error("[TieredOrchestration] L1 routing failed", error);

    // In transport-only proxy mode, always delegate processing to the configured agent.
    if (isProxyBrain && proxyDelegateAgentId) {
      const fallbackStartedAt = Date.now();
      try {
        const fallbackAgentId = proxyDelegateAgentId;
        const proxyFallbackTimeoutMs = Math.min(l1TimeoutMs, 7000);
        // #region agent log
        fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "answer-service.ts:L1catch:fallback",
            message: "Proxy L1 fallback routing",
            data: {
              fallbackAgentId,
              proxyDelegateAgentId: proxyDelegateAgentId ?? null,
              level2AgentId: level2AgentId ?? null,
              provider: entryAgent.provider,
              proxyFallbackTimeoutMs,
            },
            timestamp: Date.now(),
            hypothesisId: "H16",
          }),
        }).catch(() => {});
        // #endregion
        const providerFallbackL1 = await withTimeout(
          routeAgentChat({
            tenantId,
            agentId: fallbackAgentId,
            message: request.message,
            conversationId: request.conversationId,
            channel: request.channel,
            userId: request.userId,
            metadata: {
              ...baseMetadata,
              tieredEscalationSource: "proxy_l1_provider_fallback",
            },
          }),
          proxyFallbackTimeoutMs,
          "Proxy L1 fallback routing timed out"
        );
        // #region agent log
        fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "answer-service.ts:L1catch:fallback-success",
            message: "Proxy L1 fallback completed",
            data: {
              fallbackAgentId,
              elapsedMs: Date.now() - fallbackStartedAt,
            },
            timestamp: Date.now(),
            hypothesisId: "H16",
          }),
        }).catch(() => {});
        // #endregion
        return buildAnswerResponse(request, providerFallbackL1);
      } catch (providerFallbackError) {
        // #region agent log
        fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "answer-service.ts:L1catch:fallback-error",
            message: "Proxy L1 fallback failed",
            data: {
              error:
                providerFallbackError instanceof Error
                  ? providerFallbackError.message
                  : String(providerFallbackError),
              elapsedMs: Date.now() - fallbackStartedAt,
            },
            timestamp: Date.now(),
            hypothesisId: "H16",
          }),
        }).catch(() => {});
        // #endregion
        console.error(
          "[TieredOrchestration] Proxy L1 provider fallback failed",
          providerFallbackError
        );
      }
    }

    // When L1 fails, still consider escalation from user message so strategic intents get L2
    const intentOnFailure = detectTieredIntent(request.message, "");
    if (
      level2AgentId &&
      intentOnFailure.escalate &&
      intentOnFailure.confidence >= TIERED_ESCALATION_CONFIDENCE_THRESHOLD
    ) {
      try {
        const fallbackL2 = await routeAgentChat({
          tenantId,
          agentId: level2AgentId,
          message: request.message,
          conversationId: request.conversationId ?? "",
          channel: request.channel,
          userId: request.userId,
          metadata: {
            ...baseMetadata,
            tieredEscalationSource: "l1_fallback",
          },
        });
        await markConversationEscalated({
          tenantId,
          conversationId: fallbackL2.conversationId,
          targetAgentId: level2AgentId,
          existingMetadata: existingConversationMetadata,
        });
        return buildAnswerResponse(request, fallbackL2, TIERED_LEVEL2_BANNER);
      } catch (l2Error) {
        console.error("[TieredOrchestration] L2 fallback after L1 failure", l2Error);
      }
    }
    return buildAnswerResponse(request, {
      agentId: entryAgent.id,
      provider: entryAgent.provider,
      conversationId: request.conversationId ?? "",
      externalConversationId: request.externalConversationId,
      message: safeL1FailureMessage,
    });
  }

  const intent = detectTieredIntent(request.message, l1Response.message);

  // #region agent log
  fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "answer-service.ts:intent",
      message: "Intent detection result",
      data: {
        escalate: intent.escalate,
        confidence: intent.confidence,
        threshold: TIERED_ESCALATION_CONFIDENCE_THRESHOLD,
        level2AgentId: level2AgentId ?? null,
      },
      timestamp: Date.now(),
      hypothesisId: "H3",
    }),
  }).catch(() => {});
  // #endregion

  if (!intent.escalate || intent.confidence < TIERED_ESCALATION_CONFIDENCE_THRESHOLD) {
    return buildAnswerResponse(request, l1Response);
  }

  const targetAgentId = level2AgentId;
  if (!targetAgentId) {
    await logTieredWarning({
      tenantId,
      level: 2,
      reason: "missing_target_agent",
      conversationId: l1Response.conversationId,
      entryAgentId: entryAgent.id,
    });

    return buildAnswerResponse(request, {
      ...l1Response,
      message: safeFallbackMessage ?? DEFAULT_L2_UNAVAILABLE_MESSAGE,
    });
  }

  let escalatedResponse: AgentChatResponse;
  try {
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "answer-service.ts:beforeL2",
        message: "Calling L2",
        data: { targetAgentId },
        timestamp: Date.now(),
        hypothesisId: "H4",
      }),
    }).catch(() => {});
    // #endregion
    escalatedResponse = await routeAgentChat({
      tenantId,
      agentId: targetAgentId,
      message: request.message,
      conversationId: l1Response.conversationId,
      channel: request.channel,
      userId: request.userId,
      metadata: {
        ...baseMetadata,
        tieredEscalationSource: "this_turn",
        tieredEscalationLevel: 2,
        tieredEscalationConfidence: intent.confidence,
      },
    });
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "answer-service.ts:afterL2",
        message: "L2 success",
        data: { agentId: escalatedResponse.agentId },
        timestamp: Date.now(),
        hypothesisId: "H5",
      }),
    }).catch(() => {});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "answer-service.ts:L2catch",
        message: "L2 routing failed",
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now(),
        hypothesisId: "H5",
      }),
    }).catch(() => {});
    // #endregion
    console.error("[TieredOrchestration] L2 routing failed", error);
    const fallback =
      safeFallbackMessage ??
      "I've connected you to our strategic team, but they're temporarily unavailable. Please try again in a moment.";
    return buildAnswerResponse(request, {
      ...l1Response,
      message: `${l1Response.message}\n\n${fallback}`,
    });
  }

  await markConversationEscalated({
    tenantId,
    conversationId: escalatedResponse.conversationId,
    targetAgentId,
    existingMetadata: existingConversationMetadata,
  });

  return buildAnswerResponse(request, escalatedResponse, TIERED_LEVEL2_BANNER);
}
