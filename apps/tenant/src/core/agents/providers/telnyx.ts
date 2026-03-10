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
    const externalConversationId = request.externalConversationId?.trim();
    let resolvedConversationId = externalConversationId || randomUUID();
    const requestBodyBase: Record<string, unknown> = { content: request.message };
    const requestBodyWithConversation: Record<string, unknown> = {
      ...requestBodyBase,
      conversation_id: resolvedConversationId,
    };
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "providers/telnyx.ts:sendMessage:beforeRequest",
        message: "Sending Telnyx provider request",
        data: {
          hasExternalConversationId: Boolean(externalConversationId),
          hasInternalConversationId: Boolean(request.conversationId),
          sendWithConversationId: true,
          sendingConversationId: resolvedConversationId.slice(0, 36),
          messageLen: request.message.length,
        },
        timestamp: Date.now(),
        hypothesisId: "H15",
      }),
    }).catch(() => {});
    // #endregion

    let response: TelnyxChatResponse;
    try {
      response = await transport.request<TelnyxChatResponse>(
        `/ai/assistants/${assistantId}/chat`,
        {
          method: "POST",
          body: requestBodyWithConversation,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isConversationNotFound =
        /10005|Resource not found|Error fetching conversation/i.test(errorMessage);
      // #region agent log
      fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "providers/telnyx.ts:sendMessage:requestError",
          message: "Telnyx provider request failed",
          data: {
            error: errorMessage,
            sendWithConversationId: true,
            sendingConversationId: resolvedConversationId.slice(0, 36),
            willRetryWithFreshConversationId: isConversationNotFound,
          },
          timestamp: Date.now(),
          hypothesisId: "H15",
        }),
      }).catch(() => {});
      // #endregion
      if (isConversationNotFound) {
        resolvedConversationId = randomUUID();
        response = await transport.request<TelnyxChatResponse>(
          `/ai/assistants/${assistantId}/chat`,
          {
            method: "POST",
            body: {
              ...requestBodyBase,
              conversation_id: resolvedConversationId,
            },
          }
        );
      } else {
        throw error;
      }
    }

    const content = extractContent(response);
    const inputTokens = estimateTokenCount(request.message);
    const outputTokens = estimateTokenCount(content);
    const estimatedCost = inputTokens * 0.0000025 + outputTokens * 0.00001;

    return {
      content,
      externalConversationId: extractConversationId(response) ?? resolvedConversationId,
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

