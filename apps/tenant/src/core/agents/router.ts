import "server-only";

import { randomUUID } from "crypto";
import { createAdminClient } from "@/core/database/admin-client";
import { getAgentProviderDriver } from "./providers";
import {
  getAgentInstanceById,
  getAgentInstanceByPublicKey,
  getPrimaryListingAgent,
  recordAgentUsageEvent,
  updateAgentInstance,
} from "./registry";
import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentInstance,
  CrossAgentMode,
  RecordAgentUsageInput,
} from "./types";

function buildConversationTitle(message: string) {
  const title = message.trim().slice(0, 60);
  return title.length < message.trim().length ? `${title}...` : title;
}

function extractString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveCrossAgentMode(agent: AgentInstance): CrossAgentMode {
  const mode = extractString(agent.routing?.crossAgentMode);
  return mode === "help" ? "help" : "handoff";
}

function buildHelpRequestMessage(args: {
  userMessage: string;
  primaryAgentName: string;
  primaryAgentResponse: string;
  handoffReason?: string;
}) {
  return [
    "You are a specialist assistant helping another agent respond better.",
    "Provide a concise improvement or additional helpful details that can be shown to the user.",
    "Do not mention internal system details unless the user asked for them.",
    "",
    `User message:\n${args.userMessage}`,
    "",
    `Primary agent (${args.primaryAgentName}) draft response:\n${args.primaryAgentResponse}`,
    ...(args.handoffReason
      ? ["", `Context: escalation intent detected (${args.handoffReason}).`]
      : []),
  ].join("\n");
}

export async function ensureConversation(args: {
  tenantId: string;
  conversationId?: string;
  agent: AgentInstance;
  channel?: string;
  listingExternalId?: string;
  providerConversationId?: string;
}) {
  if (args.conversationId) return args.conversationId;
  const admin = createAdminClient();
  const { data, error } = await (admin.from("chatbot_conversations") as any)
    .insert({
      tenant_id: args.tenantId,
      title: `Chat with ${args.agent.display_name}`,
      metadata: {
        source: "agent_router",
        agent_id: args.agent.id,
        provider: args.agent.provider,
        channel: args.channel ?? "webchat",
        listing_external_id: args.listingExternalId ?? null,
        provider_conversation_id: args.providerConversationId ?? null,
      },
    })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }
  return String(data.id);
}

export async function persistConversationMessages(args: {
  tenantId: string;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  agent: AgentInstance;
  channel?: string;
  providerConversationId?: string;
}) {
  const admin = createAdminClient();
  const rows = [
    {
      conversation_id: args.conversationId,
      tenant_id: args.tenantId,
      role: "user",
      content: args.userMessage,
      metadata: {
        source: "agent_router",
        agent_id: args.agent.id,
        provider: args.agent.provider,
        channel: args.channel ?? "webchat",
      },
    },
    {
      conversation_id: args.conversationId,
      tenant_id: args.tenantId,
      role: "assistant",
      content: args.assistantMessage,
      metadata: {
        source: "agent_router",
        agent_id: args.agent.id,
        provider: args.agent.provider,
        channel: args.channel ?? "webchat",
        provider_conversation_id: args.providerConversationId ?? null,
      },
    },
  ];

  const { error } = await (admin.from("chatbot_messages") as any).insert(rows);
  if (error) {
    throw new Error(`Failed to persist chat messages: ${error.message}`);
  }

  const { error: convoError } = await (admin.from("chatbot_conversations") as any)
    .update({
      title: buildConversationTitle(args.userMessage),
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.conversationId)
    .eq("tenant_id", args.tenantId);
  if (convoError) {
    throw new Error(`Failed to update conversation metadata: ${convoError.message}`);
  }
}

async function emitAgentEvent(args: {
  tenantId: string;
  provider: string;
  eventType: string;
  externalId?: string;
  payload: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await (admin.from("ai_agent_events") as any).insert({
    tenant_id: args.tenantId,
    provider: args.provider,
    event_type: args.eventType,
    external_id: args.externalId ?? null,
    payload: args.payload,
  });
  if (error) {
    throw new Error(`Failed to emit ai_agent_event: ${error.message}`);
  }
}

function normalizeUsage(
  usage: RecordAgentUsageInput | undefined,
  provider: string,
  channel: string
): RecordAgentUsageInput {
  return {
    channel,
    provider,
    event_type: usage?.event_type ?? "agent.chat.completed",
    input_tokens: Number(usage?.input_tokens ?? 0),
    output_tokens: Number(usage?.output_tokens ?? 0),
    audio_seconds: Number(usage?.audio_seconds ?? 0),
    transcription_seconds: Number(usage?.transcription_seconds ?? 0),
    tool_calls: Number(usage?.tool_calls ?? 0),
    estimated_cost: Number(usage?.estimated_cost ?? 0),
    currency: usage?.currency ?? "USD",
    trace_id: usage?.trace_id,
    metadata: usage?.metadata ?? {},
  };
}

async function maybeRecordBillableCost(args: {
  tenantId: string;
  agentId: string;
  usage: RecordAgentUsageInput;
}) {
  const estimatedCost = Number(args.usage.estimated_cost ?? 0);
  if (estimatedCost <= 0) return;

  try {
    const { recordCostAndBillAction } = await import(
      "@/app/actions/billing/usage-costs"
    );
    await recordCostAndBillAction({
      tenantId: args.tenantId,
      costType: "ai_minutes",
      costAmount: estimatedCost,
      units:
        Number(args.usage.audio_seconds ?? 0) > 0
          ? Number(args.usage.audio_seconds ?? 0) / 60
          : 1,
      currency: args.usage.currency ?? "USD",
      sourceId: args.usage.trace_id ?? undefined,
      sourceType: "agent_usage_event",
      metadata: {
        ...(args.usage.metadata ?? {}),
        agent_id: args.agentId,
        provider: args.usage.provider,
      },
    });
  } catch (error) {
    console.error("[AgentRouter] Non-fatal billing error:", error);
  }
}

async function resolveAgent(
  input: AgentChatRequest
): Promise<{ agent: AgentInstance; tenantId: string }> {
  if (input.agentId) {
    const agent = await getAgentInstanceById(input.tenantId, input.agentId);
    if (!agent) throw new Error("Agent not found.");
    return { agent, tenantId: input.tenantId };
  }

  if (input.publicKey) {
    const agent = await getAgentInstanceByPublicKey(input.publicKey);
    if (!agent) throw new Error("Public agent key is invalid.");
    return { agent, tenantId: agent.tenant_id };
  }

  if (input.listingExternalId) {
    const listingAgent = await getPrimaryListingAgent(
      input.tenantId,
      input.listingExternalId
    );
    if (!listingAgent) {
      throw new Error("No agent bound to the listing.");
    }
    return { agent: listingAgent, tenantId: input.tenantId };
  }

  throw new Error("Agent selector missing. Provide agentId, publicKey, or listingExternalId.");
}

export async function routeAgentChat(
  input: AgentChatRequest
): Promise<AgentChatResponse> {
  if (!input.message?.trim()) {
    throw new Error("Message is required.");
  }

  const resolved = await resolveAgent(input);
  const agent = resolved.agent;
  const tenantId = resolved.tenantId;
  if (agent.status === "archived") {
    throw new Error("Agent is archived.");
  }
  if (agent.status === "paused") {
    throw new Error("Agent is paused.");
  }

  const provider = getAgentProviderDriver(agent.provider);
  const traceId = randomUUID();
  await emitAgentEvent({
    tenantId,
    provider: agent.provider,
    eventType: "agent.chat.started",
    externalId: agent.external_ref ?? undefined,
    payload: {
      trace_id: traceId,
      agent_id: agent.id,
      channel: input.channel ?? "webchat",
      listing_external_id: input.listingExternalId ?? null,
      has_user: Boolean(input.userId),
    },
  });

  const providerResult = await provider.sendMessage({
    tenantId,
    agent,
    message: input.message,
    conversationId: input.conversationId,
    externalConversationId: input.metadata?.externalConversationId as
      | string
      | undefined,
    channel: input.channel ?? "webchat",
    userId: input.userId,
    metadata: {
      ...(input.metadata ?? {}),
      listingExternalId: input.listingExternalId,
      traceId,
    },
  });

  const derivedHandoffMode = providerResult.handoffMode ?? resolveCrossAgentMode(agent);

  let conversationId =
    providerResult.conversationId ?? input.conversationId ?? undefined;
  if (!conversationId) {
    conversationId = await ensureConversation({
      tenantId,
      conversationId,
      agent,
      channel: input.channel,
      listingExternalId: input.listingExternalId,
      providerConversationId: providerResult.externalConversationId,
    });
  }

  // Advanced provider already writes into chatbot_* tables through processChatMessage.
  if (agent.provider !== "advanced") {
    await persistConversationMessages({
      tenantId,
      conversationId,
      userMessage: input.message,
      assistantMessage: providerResult.content,
      agent,
      channel: input.channel,
      providerConversationId: providerResult.externalConversationId,
    });
  }

  const usage = normalizeUsage(
    {
      channel: (input.channel ?? "webchat") as string,
      provider: agent.provider,
      event_type: "agent.chat.completed",
      input_tokens: providerResult.usage?.inputTokens ?? 0,
      output_tokens: providerResult.usage?.outputTokens ?? 0,
      audio_seconds: providerResult.usage?.audioSeconds ?? 0,
      transcription_seconds: providerResult.usage?.transcriptionSeconds ?? 0,
      tool_calls: providerResult.usage?.toolCalls ?? 0,
      estimated_cost: providerResult.usage?.estimatedCost ?? 0,
      currency: providerResult.usage?.currency ?? "USD",
      trace_id: traceId,
      metadata: {
        ...(input.metadata ?? {}),
        listing_external_id: input.listingExternalId ?? null,
      },
    },
    agent.provider,
    input.channel ?? "webchat"
  );

  await recordAgentUsageEvent(tenantId, agent.id, usage);
  await maybeRecordBillableCost({ tenantId, agentId: agent.id, usage });

  await emitAgentEvent({
    tenantId,
    provider: agent.provider,
    eventType: "agent.chat.completed",
    externalId:
      providerResult.externalConversationId ?? agent.external_ref ?? undefined,
    payload: {
      trace_id: traceId,
      agent_id: agent.id,
      conversation_id: conversationId,
      provider_conversation_id: providerResult.externalConversationId ?? null,
      handoff_suggested: providerResult.handoffSuggested ?? false,
      handoff_reason: providerResult.handoffReason ?? null,
      handoff_target_agent_id: providerResult.handoffTargetAgentId ?? null,
      handoff_mode: derivedHandoffMode,
      usage,
    },
  });

  const isInternalCrossAgent =
    Boolean((input.metadata ?? {}).__internal_cross_agent) ||
    Number((input.metadata ?? {}).__cross_agent_depth ?? 0) > 0;

  let helpFromAgentId: string | undefined;
  let helpContent: string | undefined;

  if (
    !isInternalCrossAgent &&
    providerResult.handoffSuggested &&
    providerResult.handoffTargetAgentId &&
    derivedHandoffMode === "help"
  ) {
    await emitAgentEvent({
      tenantId,
      provider: agent.provider,
      eventType: "agent.help.requested",
      externalId: agent.external_ref ?? undefined,
      payload: {
        trace_id: traceId,
        from_agent_id: agent.id,
        to_agent_id: providerResult.handoffTargetAgentId,
        conversation_id: conversationId,
      },
    });

    const helpResponse = await routeAgentChat({
      tenantId,
      agentId: providerResult.handoffTargetAgentId,
      message: buildHelpRequestMessage({
        userMessage: input.message,
        primaryAgentName: agent.display_name,
        primaryAgentResponse: providerResult.content,
        handoffReason: providerResult.handoffReason,
      }),
      channel: input.channel ?? "webchat",
      userId: input.userId,
      metadata: {
        ...(input.metadata ?? {}),
        __internal_cross_agent: true,
        __cross_agent_depth: 1,
        requestedByAgentId: agent.id,
        requestedByConversationId: conversationId,
        requestedByTraceId: traceId,
      },
    });

    helpFromAgentId = helpResponse.agentId;
    helpContent = helpResponse.message;

    await emitAgentEvent({
      tenantId,
      provider: agent.provider,
      eventType: "agent.help.completed",
      externalId: agent.external_ref ?? undefined,
      payload: {
        trace_id: traceId,
        from_agent_id: agent.id,
        to_agent_id: providerResult.handoffTargetAgentId,
        conversation_id: conversationId,
        help_conversation_id: helpResponse.conversationId,
      },
    });
  } else if (
    !isInternalCrossAgent &&
    providerResult.handoffSuggested &&
    providerResult.handoffTargetAgentId &&
    derivedHandoffMode === "handoff"
  ) {
    await emitAgentEvent({
      tenantId,
      provider: agent.provider,
      eventType: "agent.handoff.suggested",
      externalId: agent.external_ref ?? undefined,
      payload: {
        trace_id: traceId,
        from_agent_id: agent.id,
        to_agent_id: providerResult.handoffTargetAgentId,
        conversation_id: conversationId,
        reason: providerResult.handoffReason ?? null,
      },
    });
  }

  await updateAgentInstance(tenantId, agent.id, {
    metadata: {
      ...agent.metadata,
      last_trace_id: traceId,
      last_channel: input.channel ?? "webchat",
    },
  });

  const admin = createAdminClient();
  await (admin.from("agent_instances") as any)
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", agent.id)
    .eq("tenant_id", tenantId);

  return {
    agentId: agent.id,
    provider: agent.provider,
    message: providerResult.content,
    conversationId,
    externalConversationId: providerResult.externalConversationId,
    handoffSuggested: providerResult.handoffSuggested,
    handoffReason: providerResult.handoffReason,
    handoffTargetAgentId: providerResult.handoffTargetAgentId,
    handoffMode: derivedHandoffMode,
    helpFromAgentId,
    helpContent,
    usage,
  };
}

