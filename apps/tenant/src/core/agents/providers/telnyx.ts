import "server-only";

import { randomUUID } from "crypto";
import { getTelnyxTransportForWebhook } from "@/src/core/telnyx/webhook-transport";
import type { AgentProviderDriver } from "./base";
import type { AgentProviderRequest, AgentProviderResponse } from "../types";

type TelnyxChatResponse = {
  content?: string;
  conversation_id?: string;
  data?: {
    content?: string;
    conversation_id?: string;
  };
};

function extractContent(response: TelnyxChatResponse) {
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

function extractConversationId(response: TelnyxChatResponse) {
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

export class TelnyxAgentProvider implements AgentProviderDriver {
  readonly name = "telnyx";

  async sendMessage(
    request: AgentProviderRequest
  ): Promise<AgentProviderResponse> {
    const assistantId = request.agent.external_ref?.trim();
    if (!assistantId) {
      throw new Error(
        "This Telnyx-backed agent is missing external_ref (assistant_id)."
      );
    }

    const { transport } = await getTelnyxTransportForWebhook(request.tenantId);
    const conversationId =
      request.externalConversationId || request.conversationId || randomUUID();

    const response = await transport.request<TelnyxChatResponse>(
      `/ai/assistants/${assistantId}/chat`,
      {
        method: "POST",
        body: {
          content: request.message,
          conversation_id: conversationId,
        },
      }
    );
    const content = extractContent(response);
    const inputTokens = estimateTokenCount(request.message);
    const outputTokens = estimateTokenCount(content);
    const estimatedCost = inputTokens * 0.0000025 + outputTokens * 0.00001;

    return {
      content,
      externalConversationId: extractConversationId(response) ?? conversationId,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCost,
        currency: "USD",
        toolCalls: 0,
      },
      raw: response as unknown as Record<string, unknown>,
    };
  }
}

